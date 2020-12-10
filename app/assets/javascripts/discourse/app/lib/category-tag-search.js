import { cancel, later } from "@ember/runloop";
import { CANCELLED_STATUS } from "discourse/lib/autocomplete";
import Category from "discourse/models/category";
import { Promise } from "rsvp";
import { SEPARATOR } from "discourse/lib/category-hashtags";
import { TAG_HASHTAG_POSTFIX } from "discourse/lib/tag-hashtags";
import discourseDebounce from "discourse/lib/debounce";
import getURL from "discourse-common/lib/get-url";
import { isTesting } from "discourse-common/config/environment";

let cache = {};
let cacheTime;
let oldSearch;

function updateCache(term, results) {
  cache[term] = results;
  cacheTime = new Date();
  return results;
}

function searchTags(term, categories, limit) {
  return new Promise((resolve) => {
    const clearPromise = later(
      () => {
        resolve(CANCELLED_STATUS);
      },
      isTesting() ? 50 : 5000
    );

    const debouncedSearch = discourseDebounce((q, cats, resultFunc) => {
      oldSearch = $.ajax(getURL("/tags/filter/search"), {
        type: "GET",
        cache: true,
        data: { limit: limit, q },
      });

      var returnVal = CANCELLED_STATUS;

      oldSearch
        .then((r) => {
          const categoryNames = cats.map((c) => c.model.get("name"));

          const tags = r.results.map((tag) => {
            const tagName = tag.text;

            return {
              name: tagName,
              text: categoryNames.includes(tagName)
                ? `${tagName}${TAG_HASHTAG_POSTFIX}`
                : tagName,
              count: tag.count,
            };
          });

          returnVal = cats.concat(tags);
        })
        .always(() => {
          oldSearch = null;
          resultFunc(returnVal);
        });
    }, 300);

    debouncedSearch(term, categories, (result) => {
      cancel(clearPromise);
      resolve(updateCache(term, result));
    });
  });
}

export function search(term, siteSettings) {
  if (oldSearch) {
    oldSearch.abort();
    oldSearch = null;
  }

  if (new Date() - cacheTime > 30000) {
    cache = {};
  }
  const cached = cache[term];
  if (cached) {
    return cached;
  }

  const limit = 5;
  var categories = Category.search(term, { limit });
  var numOfCategories = categories.length;

  categories = categories.map((category) => {
    return { model: category, text: Category.slugFor(category, SEPARATOR, 2) };
  });

  if (numOfCategories !== limit && siteSettings.tagging_enabled) {
    return searchTags(term, categories, limit - numOfCategories);
  } else {
    return updateCache(term, categories);
  }
}
