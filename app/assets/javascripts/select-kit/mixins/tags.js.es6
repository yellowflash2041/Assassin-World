const { run, get } = Ember;
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Ember.Mixin.create({
  willDestroyElement() {
    this._super(...arguments);

    const searchDebounce = this.searchDebounce;
    if (searchDebounce) run.cancel(searchDebounce);
  },

  searchTags(url, data, callback) {
    this.startLoading();

    return ajax(Discourse.getURL(url), {
      quietMillis: 200,
      cache: true,
      dataType: "json",
      data
    })
      .then(json => {
        this.set("asyncContent", callback(this, json));
        this.autoHighlight();
      })
      .catch(error => popupAjaxError(error))
      .finally(() => this.stopLoading());
  },

  validateCreate(term) {
    if (this.hasReachedMaximum || !this.site.get("can_create_tag")) {
      return false;
    }

    const filterRegexp = new RegExp(this.site.tags_filter_regexp, "g");
    term = term
      .replace(filterRegexp, "")
      .trim()
      .toLowerCase();

    if (!term.length || this.termMatchesForbidden) {
      return false;
    }

    if (this.get("siteSettings.max_tag_length") < term.length) {
      return false;
    }

    const toLowerCaseOrUndefined = string => {
      return string === undefined ? undefined : string.toLowerCase();
    };

    const inCollection = this.collectionComputedContent
      .map(c => toLowerCaseOrUndefined(get(c, "id")))
      .includes(term);

    const inSelection = this.selection
      .map(s => toLowerCaseOrUndefined(get(s, "value")))
      .includes(term);

    if (inCollection || inSelection) {
      return false;
    }

    return true;
  },

  createContentFromInput(input) {
    // See lib/discourse_tagging#clean_tag.
    let content = input
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[\/\?#\[\]@!\$&'\(\)\*\+,;=\.%\\`^\s|\{\}"<>]+/g, "")
      .substring(0, this.siteSettings.max_tag_length);

    if (this.siteSettings.force_lowercase_tags) {
      content = content.toLowerCase();
    }

    return content;
  }
});
