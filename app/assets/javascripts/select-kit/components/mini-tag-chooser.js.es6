import ComboBox from "select-kit/components/combo-box";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from 'discourse/lib/ajax-error';
import { default as computed } from "ember-addons/ember-computed-decorators";
import renderTag from "discourse/lib/render-tag";
const { get, isEmpty, isPresent, run, makeArray } = Ember;

export default ComboBox.extend({
  allowContentReplacement: true,
  pluginApiIdentifiers: ["mini-tag-chooser"],
  classNames: ["mini-tag-chooser"],
  classNameBindings: ["noTags"],
  verticalOffset: 3,
  filterable: true,
  noTags: Ember.computed.empty("computedTags"),
  allowAny: true,
  maximumSelectionSize: Ember.computed.alias("siteSettings.max_tags_per_topic"),
  caretUpIcon: Ember.computed.alias("caretIcon"),
  caretDownIcon: Ember.computed.alias("caretIcon"),

  init() {
    this._super();

    this.set("termMatchesForbidden", false);

    this.set("templateForRow", (rowComponent) => {
      const tag = rowComponent.get("computedContent");
      return renderTag(get(tag, "value"), {
        count: get(tag, "originalContent.count"),
        noHref: true
      });
    });
  },

  @computed("limitReached", "maximumSelectionSize")
  maxContentRow(limitReached, count) {
    if (limitReached) {
      return I18n.t("select_kit.max_content_reached", { count });
    }
  },

  mutateAttributes() {
    this.set("value", null);
  },

  @computed("limitReached")
  caretIcon(limitReached) {
    return limitReached ? null : "plus";
  },

  @computed("computedTags.[]", "maximumSelectionSize")
  limitReached(computedTags, maximumSelectionSize) {
    if (computedTags.length >= maximumSelectionSize) {
      return true;
    }

    return false;
  },

  @computed("tags")
  computedTags(tags) {
    return makeArray(tags);
  },

  validateCreate(term) {
    if (this.get("limitReached") || !this.site.get("can_create_tag")) {
      return false;
    }

    const filterRegexp = new RegExp(this.site.tags_filter_regexp, "g");
    term = term.replace(filterRegexp, "").trim().toLowerCase();

    if (!term.length || this.get("termMatchesForbidden")) {
      return false;
    }

    if (this.get("siteSettings.max_tag_length") < term.length) {
      return false;
    }

    return true;
  },

  validateSelect() {
    return this.get("computedTags").length < this.get("siteSettings.max_tags_per_topic");
  },

  filterComputedContent(computedContent) {
    return computedContent;
  },

  didRender() {
    this._super();

    this.$().on("click.mini-tag-chooser", ".selected-tag", (event) => {
      event.stopImmediatePropagation();
      this.send("removeTag", $(event.target).attr("data-value"));
    });
  },

  willDestroyElement() {
    this._super();

    $(".select-kit-body").off("click.mini-tag-chooser");

    const searchDebounce = this.get("searchDebounce");
    if (isPresent(searchDebounce)) { run.cancel(searchDebounce); }
  },

  didPressEscape(event) {
    const $lastSelectedTag = $(".selected-tag.selected:last");

    if ($lastSelectedTag && this.get("isExpanded")) {
      $lastSelectedTag.removeClass("selected");
      this._destroyEvent(event);
    } else {
      this._super(event);
    }
  },

  backspaceFromFilter(event) {
    this.didPressBackspace(event);
  },

  didPressBackspace() {
    if (!this.get("isExpanded")) {
      this.expand();
      return;
    }

    const $lastSelectedTag = $(".selected-tag:last");

    if (!isEmpty(this.get("filter"))) {
      $lastSelectedTag.removeClass("is-highlighted");
      return;
    }

    if (!$lastSelectedTag.length) return;

    if (!$lastSelectedTag.hasClass("is-highlighted")) {
      $lastSelectedTag.addClass("is-highlighted");
    } else {
      this.send("removeTag", $lastSelectedTag.attr("data-value"));
    }
  },

  @computed("tags.[]", "filter")
  collectionHeader(tags, filter) {
    if (!isEmpty(tags)) {
      let output = "";

      if (tags.length >= 20) {
        tags = tags.filter(t => t.indexOf(filter) >= 0);
      }

      tags.map((tag) => {
        output += `
          <button class="selected-tag" data-value="${tag}">
            ${tag}
          </button>
        `;
      });

      return `<div class="selected-tags">${output}</div>`;
    }
  },

  computeHeaderContent() {
    let content = this.baseHeaderComputedContent();
    const joinedTags = this.get("computedTags").join(", ");

    if (isEmpty(this.get("computedTags"))) {
      content.label = I18n.t("tagging.choose_for_topic");
    } else {
      content.label = joinedTags;
    }

    content.title = content.name = content.value = joinedTags;

    return content;
  },

  actions: {
    removeTag(tag) {
      let tags = this.get("computedTags");
      delete tags[tags.indexOf(tag)];
      this.set("tags", tags.filter(t => t));
      this.set("content", []);
      this.set("searchDebounce", run.debounce(this, this._searchTags, this.get("filter"), 250));
    },

    onExpand() {
      if (isEmpty(this.get("content"))) {
        this.set("searchDebounce", run.debounce(this, this._searchTags, this.get("filter"), 250));
      }
    },

    onFilter(filter) {
      filter = isEmpty(filter) ? null : filter;
      this.set("searchDebounce", run.debounce(this, this._searchTags, filter, 250));
    },

    onSelect(tag) {
      if (isEmpty(this.get("computedTags"))) {
        this.set("tags", makeArray(tag));
      } else {
        this.set("tags", this.get("computedTags").concat(tag));
      }

      this.set("content", []);
      this.set("searchDebounce", run.debounce(this, this._searchTags, this.get("filter"), 250));
    }
  },

  _searchTags(query) {
    this.startLoading();

    const self = this;
    const selectedTags = makeArray(this.get("computedTags")).filter(t => t);
    const sortTags = this.siteSettings.tags_sort_alphabetically;
    const data = {
      q: query,
      limit: this.siteSettings.max_tag_search_results,
      categoryId: this.get("categoryId")
    };

    if (selectedTags) {
      data.selected_tags = selectedTags.slice(0, 100);
    }

    ajax(Discourse.getURL("/tags/filter/search"), {
        quietMillis: 200,
        cache: true,
        dataType: "json",
        data,
      }).then(json => {
        let results = json.results;

        self.set("termMatchesForbidden", json.forbidden ? true : false);

        if (sortTags) {
          results = results.sort((a, b) => a.id > b.id);
        }

        const content = results.map((result) => {
          return {
            id: result.text,
            name: result.text,
            count: result.count
          };
        }).filter(c => !selectedTags.includes(c.id));

        self.set("content", content);
        self.stopLoading();
        this.autoHighlight();
      }).catch(error => {
        self.stopLoading();
        popupAjaxError(error);
      });
  }
});
