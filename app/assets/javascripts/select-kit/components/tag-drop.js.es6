import ComboBoxComponent from "select-kit/components/combo-box";
import DiscourseURL from "discourse/lib/url";
import { default as computed } from "ember-addons/ember-computed-decorators";
const { isEmpty } = Ember;

export default ComboBoxComponent.extend({
  pluginApiIdentifiers: ["tag-drop"],
  classNameBindings: ["categoryStyle", "tagClass"],
  classNames: "tag-drop",
  verticalOffset: 3,
  value: Ember.computed.alias("tagId"),
  headerComponent: "tag-drop/tag-drop-header",
  rowComponent: "tag-drop/tag-drop-row",
  allowAutoSelectFirst: false,
  tagName: "li",
  showFilterByTag: Ember.computed.alias("siteSettings.show_filter_by_tag"),
  currentCategory: Ember.computed.or("secondCategory", "firstCategory"),
  tagId: null,
  categoryStyle: Ember.computed.alias("siteSettings.category_style"),
  mutateAttributes() {},
  fullWidthOnMobile: true,

  @computed("tagId")
  noTagsSelected() {
    return this.get("tagId") === "none";
  },

  @computed("showFilterByTag", "content")
  isHidden(showFilterByTag, content) {
    if (showFilterByTag && !isEmpty(content)) return false;
    return true;
  },

  computeHeaderContent() {
    let content = this.baseHeaderComputedContent();

    if (!content.value) {
      if (this.get("noTagsSelected")) {
        content.label = this.get("noTagsLabel");
      } else {
        content.label = this.get("allTagsLabel");
      }
    }

    return content;
  },

  @computed("tagId")
  tagClass(tagId) {
    return tagId ? `tag-${tagId}` : "tag_all";
  },

  @computed("firstCategory", "secondCategory")
  allTagsUrl() {
    if (this.get("currentCategory")) {
      return this.get("currentCategory.url") + "?allTags=1";
    } else {
      return "/";
    }
  },

  @computed("firstCategory", "secondCategory")
  noTagsUrl() {
    var url = "/tags";
    if (this.get("currentCategory")) {
      url += this.get("currentCategory.url");
    }
    return `${url}/none`;
  },

  @computed("allTagsUrl", "allTagsLabel", "noTagsUrl", "noTagsLabel")
  collectionHeader(allTagsUrl, allTagsLabel, noTagsUrl, noTagsLabel) {
    return `
      <a href="${allTagsUrl}" class="tag-filter">
        ${allTagsLabel}
      </a>
      <a href="${noTagsUrl}" class="tag-filter">
        ${noTagsLabel}
      </a>
    `;
  },

  @computed("tag")
  allTagsLabel() {
    return I18n.t("tagging.selector_all_tags");
  },

  @computed("tag")
  noTagsLabel() {
    return I18n.t("tagging.selector_no_tags");
  },

  @computed("site.top_tags")
  content(topTags) {
    if (this.siteSettings.tags_sort_alphabetically && topTags) {
      return topTags.sort();
    } else {
      return topTags;
    }
  },

  actions: {
    onSelect(tagId) {
      let url = "/tags";
      if (this.get("currentCategory")) {
        url += this.get("currentCategory.url");
      }
      url = `${url}/${tagId}`;
      DiscourseURL.routeTo(url);
    }
  }
});
