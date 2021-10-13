import { isValidSearchTerm, searchForTerm } from "discourse/lib/search";
import DiscourseURL from "discourse/lib/url";
import { createWidget } from "discourse/widgets/widget";
import discourseDebounce from "discourse-common/lib/debounce";
import getURL from "discourse-common/lib/get-url";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";
import { isiPad } from "discourse/lib/utilities";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { Promise } from "rsvp";
import { search as searchCategoryTag } from "discourse/lib/category-tag-search";
import userSearch from "discourse/lib/user-search";
import { CANCELLED_STATUS } from "discourse/lib/autocomplete";

const CATEGORY_SLUG_REGEXP = /(\#[a-zA-Z0-9\-:]*)$/gi;
const USERNAME_REGEXP = /(\@[a-zA-Z0-9\-\_]*)$/gi;
const SUGGESTIONS_REGEXP = /(in:|status:|order:|:)([a-zA-Z]*)$/gi;
export const TOPIC_REPLACE_REGEXP = /\stopic:\d+/i;
export const MODIFIER_REGEXP = /.*(\#|\@|:).*$/gi;
export const DEFAULT_TYPE_FILTER = "exclude_topics";

const searchData = {};

export function initSearchData() {
  searchData.loading = false;
  searchData.results = {};
  searchData.noResults = false;
  searchData.term = undefined;
  searchData.typeFilter = DEFAULT_TYPE_FILTER;
  searchData.invalidTerm = false;
  searchData.suggestionResults = [];
  searchData.suggestionKeyword = false;
}

initSearchData();

// Helps with debouncing and cancelling promises
const SearchHelper = {
  _activeSearch: null,

  // for cancelling debounced search
  cancel() {
    if (this._activeSearch) {
      this._activeSearch.abort();
      this._activeSearch = null;
    }
  },

  perform(widget) {
    this.cancel();

    const { term, typeFilter } = searchData;
    const fullSearchUrl = widget.fullSearchUrl();
    const matchSuggestions = this.matchesSuggestions();

    if (matchSuggestions) {
      searchData.noResults = true;
      searchData.results = {};
      searchData.loading = false;
      searchData.suggestionResults = [];

      if (matchSuggestions.type === "category") {
        const categorySearchTerm = matchSuggestions.categoriesMatch[0].replace(
          "#",
          ""
        );

        const categoryTagSearch = searchCategoryTag(
          categorySearchTerm,
          widget.siteSettings
        );
        Promise.resolve(categoryTagSearch).then((results) => {
          if (results !== CANCELLED_STATUS) {
            searchData.suggestionResults = results;
            searchData.suggestionKeyword = "#";
          }
          widget.scheduleRerender();
        });
      } else if (matchSuggestions.type === "username") {
        const userSearchTerm = matchSuggestions.usernamesMatch[0].replace(
          "@",
          ""
        );
        const opts = { includeGroups: true, limit: 6 };
        if (userSearchTerm.length > 0) {
          opts.term = userSearchTerm;
        } else {
          opts.lastSeenUsers = true;
        }

        userSearch(opts).then((result) => {
          if (result?.users?.length > 0) {
            searchData.suggestionResults = result.users;
            searchData.suggestionKeyword = "@";
          } else {
            searchData.noResults = true;
            searchData.suggestionKeyword = false;
          }
          widget.scheduleRerender();
        });
      } else {
        searchData.suggestionKeyword = matchSuggestions[0];
        widget.scheduleRerender();
      }
      return;
    }

    searchData.suggestionKeyword = false;

    if (!term) {
      searchData.noResults = false;
      searchData.results = [];
      searchData.loading = false;
      searchData.invalidTerm = false;

      widget.scheduleRerender();
    } else if (!isValidSearchTerm(term, widget.siteSettings)) {
      searchData.noResults = true;
      searchData.results = [];
      searchData.loading = false;
      searchData.invalidTerm = true;

      widget.scheduleRerender();
    } else {
      searchData.invalidTerm = false;

      this._activeSearch = searchForTerm(term, {
        typeFilter,
        fullSearchUrl,
      });
      this._activeSearch
        .then((results) => {
          // we ensure the current search term is the one used
          // when starting the query
          if (results && term === searchData.term) {
            if (term.includes("topic:")) {
              widget.appEvents.trigger("post-stream:refresh", { force: true });
            }

            searchData.noResults = results.resultTypes.length === 0;
            searchData.results = results;
          }
        })
        .catch(popupAjaxError)
        .finally(() => {
          searchData.loading = false;
          widget.scheduleRerender();
        });
    }
  },

  matchesSuggestions() {
    if (searchData.term === undefined || this.includesTopics()) {
      return false;
    }

    const term = searchData.term.trim();
    const categoriesMatch = term.match(CATEGORY_SLUG_REGEXP);

    if (categoriesMatch) {
      return { type: "category", categoriesMatch };
    }

    const usernamesMatch = term.match(USERNAME_REGEXP);
    if (usernamesMatch) {
      return { type: "username", usernamesMatch };
    }

    const suggestionsMatch = term.match(SUGGESTIONS_REGEXP);
    if (suggestionsMatch) {
      return suggestionsMatch;
    }

    return false;
  },

  includesTopics() {
    return searchData.typeFilter !== DEFAULT_TYPE_FILTER;
  },
};

export default createWidget("search-menu", {
  tagName: "div.search-menu",
  searchData,

  fullSearchUrl(opts) {
    let url = "/search";
    const params = [];

    if (searchData.term) {
      let query = "";

      query += `q=${encodeURIComponent(searchData.term)}`;

      if (query) {
        params.push(query);
      }
    }

    if (opts && opts.expanded) {
      params.push("expanded=true");
    }

    if (params.length > 0) {
      url = `${url}?${params.join("&")}`;
    }

    return getURL(url);
  },

  panelContents() {
    let searchInput = [this.attach("search-term", { value: searchData.term })];
    if (searchData.loading) {
      searchInput.push(h("div.searching", h("div.spinner")));
    } else {
      const clearButton = this.attach("link", {
        title: "search.clear_search",
        action: "clearSearch",
        className: "clear-search",
        contents: () => iconNode("times"),
      });

      const advancedSearchButton = this.attach("link", {
        href: this.fullSearchUrl({ expanded: true }),
        contents: () => iconNode("sliders-h"),
        className: "show-advanced-search",
        title: "search.open_advanced",
      });

      if (searchData.term) {
        searchInput.push(
          h("div.searching", [clearButton, advancedSearchButton])
        );
      } else {
        searchInput.push(h("div.searching", advancedSearchButton));
      }
    }

    const results = [h("div.search-input", searchInput)];

    if (!searchData.loading) {
      results.push(
        this.attach("search-menu-results", {
          term: searchData.term,
          noResults: searchData.noResults,
          results: searchData.results,
          invalidTerm: searchData.invalidTerm,
          suggestionKeyword: searchData.suggestionKeyword,
          suggestionResults: searchData.suggestionResults,
          searchTopics: SearchHelper.includesTopics(),
        })
      );
    }

    return results;
  },

  clearSearch() {
    searchData.term = "";
    const searchInput = document.getElementById("search-term");
    searchInput.value = "";
    searchInput.focus();
    this.triggerSearch();
  },

  searchService() {
    if (!this._searchService) {
      this._searchService = this.register.lookup("search-service:main");
    }
    return this._searchService;
  },

  html() {
    return this.attach("menu-panel", {
      maxWidth: 500,
      contents: () => this.panelContents(),
    });
  },

  clickOutside() {
    this.sendWidgetAction("toggleSearchMenu");
  },

  keyDown(e) {
    if (e.which === 27 /* escape */) {
      this.sendWidgetAction("toggleSearchMenu");
      e.preventDefault();
      return false;
    }

    if (searchData.loading) {
      return;
    }

    if (e.which === 65 /* a */) {
      if (document.activeElement?.classList.contains("search-link")) {
        if (document.querySelector("#reply-control.open")) {
          // add a link and focus composer

          this.appEvents.trigger(
            "composer:insert-text",
            document.activeElement.href,
            {
              ensureSpace: true,
            }
          );
          this.appEvents.trigger("header:keyboard-trigger", { type: "search" });

          e.preventDefault();
          document.querySelector("#reply-control.open textarea").focus();
          return false;
        }
      }
    }

    const up = e.which === 38;
    const down = e.which === 40;
    if (up || down) {
      let focused = document.activeElement.closest(".search-menu")
        ? document.activeElement
        : null;

      if (!focused) {
        return;
      }

      let links = document.querySelectorAll(".search-menu .results a");
      let results = document.querySelectorAll(
        ".search-menu .results .search-link"
      );

      if (!results.length) {
        return;
      }

      let prevResult;
      let result;

      links.forEach((item) => {
        if (item.classList.contains("search-link")) {
          prevResult = item;
        }

        if (item === focused) {
          result = prevResult;
        }
      });

      let index = -1;

      if (result) {
        index = Array.prototype.indexOf.call(results, result);
      }

      if (index === -1 && down) {
        document.querySelector(".search-menu .results .search-link").focus();
      } else if (index === 0 && up) {
        document.querySelector(".search-menu input#search-term").focus();
      } else if (index > -1) {
        index += down ? 1 : -1;
        if (index >= 0 && index < results.length) {
          results[index].focus();
        }
      }

      e.preventDefault();
      return false;
    }

    const searchInput = document.querySelector("#search-term");
    if (e.which === 13 && e.target === searchInput) {
      // same combination as key-enter-escape mixin
      if (e.ctrlKey || e.metaKey || (isiPad() && e.altKey)) {
        this.fullSearch();
      } else {
        searchData.typeFilter = null;
        this.triggerSearch();
      }
    }
  },

  triggerSearch() {
    searchData.noResults = false;
    if (searchData.term.includes("topic:")) {
      const highlightTerm = searchData.term.replace(TOPIC_REPLACE_REGEXP, "");
      this.searchService().set("highlightTerm", highlightTerm);
    }
    searchData.loading = SearchHelper.includesTopics() ? true : false;

    const delay = SearchHelper.includesTopics() ? 400 : 200;
    discourseDebounce(SearchHelper, SearchHelper.perform, this, delay);
  },

  moreOfType(type) {
    searchData.typeFilter = type;
    this.triggerSearch();
  },

  searchTermChanged(term, opts = {}) {
    searchData.typeFilter = opts.searchTopics ? null : DEFAULT_TYPE_FILTER;
    searchData.term = term;
    this.triggerSearch();
  },

  triggerAutocomplete(opts = {}) {
    this.searchTermChanged(opts.value, { searchTopics: opts.searchTopics });
  },

  fullSearch() {
    searchData.results = [];
    searchData.loading = false;
    SearchHelper.cancel();
    const url = this.fullSearchUrl();
    if (url) {
      this.sendWidgetEvent("linkClicked");
      DiscourseURL.routeTo(url);
    }
  },
});
