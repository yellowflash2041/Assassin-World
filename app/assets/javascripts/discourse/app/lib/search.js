import Category from "discourse/models/category";
import EmberObject from "@ember/object";
import I18n from "I18n";
import Post from "discourse/models/post";
import Topic from "discourse/models/topic";
import User from "discourse/models/user";
import { ajax } from "discourse/lib/ajax";
import { deepMerge } from "discourse-common/lib/object";
import { emojiUnescape } from "discourse/lib/text";
import { escapeExpression } from "discourse/lib/utilities";
import { findRawTemplate } from "discourse-common/lib/raw-templates";
import getURL from "discourse-common/lib/get-url";
import { isEmpty } from "@ember/utils";
import { search as searchCategoryTag } from "discourse/lib/category-tag-search";
import { userPath } from "discourse/lib/url";
import userSearch from "discourse/lib/user-search";

export function translateResults(results, opts) {
  opts = opts || {};

  results.topics = results.topics || [];
  results.users = results.users || [];
  results.posts = results.posts || [];
  results.categories = results.categories || [];
  results.tags = results.tags || [];
  results.groups = results.groups || [];

  const topicMap = {};
  results.topics = results.topics.map(function (topic) {
    topic = Topic.create(topic);
    topicMap[topic.id] = topic;
    return topic;
  });

  results.posts = results.posts.map((post) => {
    if (post.username) {
      post.userPath = userPath(post.username.toLowerCase());
    }
    post = Post.create(post);
    post.set("topic", topicMap[post.topic_id]);
    post.blurb = emojiUnescape(post.blurb);
    return post;
  });

  results.users = results.users.map(function (user) {
    return User.create(user);
  });

  results.categories = results.categories
    .map(function (category) {
      return Category.list().findBy("id", category.id);
    })
    .compact();

  results.groups = results.groups
    .map((group) => {
      const name = escapeExpression(group.name);
      const fullName = escapeExpression(group.full_name || group.display_name);
      const flairUrl = isEmpty(group.flair_url)
        ? null
        : escapeExpression(group.flair_url);
      const flairColor = escapeExpression(group.flair_color);
      const flairBgColor = escapeExpression(group.flair_bg_color);

      return {
        id: group.id,
        flairUrl,
        flairColor,
        flairBgColor,
        fullName,
        name,
        url: getURL(`/g/${name}`),
      };
    })
    .compact();

  results.tags = results.tags
    .map(function (tag) {
      const tagName = escapeExpression(tag.name);
      return EmberObject.create({
        id: tagName,
        url: getURL("/tag/" + tagName),
      });
    })
    .compact();

  results.resultTypes = [];

  // TODO: consider refactoring front end to take a better structure
  const groupedSearchResult = results.grouped_search_result;
  if (groupedSearchResult) {
    [
      ["topic", "posts"],
      ["user", "users"],
      ["group", "groups"],
      ["category", "categories"],
      ["tag", "tags"],
    ].forEach(function (pair) {
      const type = pair[0];
      const name = pair[1];
      if (results[name].length > 0) {
        const componentName =
          opts.searchContext &&
          opts.searchContext.type === "topic" &&
          type === "topic"
            ? "post"
            : type;
        const result = {
          results: results[name],
          componentName: `search-result-${componentName}`,
          type,
          more: groupedSearchResult[`more_${name}`],
        };

        if (result.more && componentName === "topic" && opts.fullSearchUrl) {
          result.more = false;
          result.moreUrl = opts.fullSearchUrl;
        }

        results.resultTypes.push(result);
      }
    });
  }

  const noResults = !!(
    !results.topics.length &&
    !results.posts.length &&
    !results.users.length &&
    !results.categories.length
  );

  return noResults ? null : EmberObject.create(results);
}

export function searchForTerm(term, opts) {
  if (!opts) {
    opts = {};
  }

  // Only include the data we have
  const data = { term: term };
  if (opts.typeFilter) {
    data.type_filter = opts.typeFilter;
  }
  if (opts.searchForId) {
    data.search_for_id = true;
  }
  if (opts.restrictToArchetype) {
    data.restrict_to_archetype = opts.restrictToArchetype;
  }

  if (opts.searchContext) {
    data.search_context = {
      type: opts.searchContext.type,
      id: opts.searchContext.id,
      name: opts.searchContext.name,
    };
  }

  let promise = ajax("/search/query", { data: data });

  promise.then((results) => {
    return translateResults(results, opts);
  });

  return promise;
}

export function searchContextDescription(type, name) {
  if (type) {
    switch (type) {
      case "topic":
        return I18n.t("search.context.topic");
      case "user":
        return I18n.t("search.context.user", { username: name });
      case "category":
        return I18n.t("search.context.category", { category: name });
      case "tag":
        return I18n.t("search.context.tag", { tag: name });
      case "private_messages":
        return I18n.t("search.context.private_messages");
    }
  }
}

export function getSearchKey(args) {
  return (
    args.q +
    "|" +
    ((args.searchContext && args.searchContext.type) || "") +
    "|" +
    ((args.searchContext && args.searchContext.id) || "")
  );
}

export function isValidSearchTerm(searchTerm, siteSettings) {
  if (searchTerm) {
    return searchTerm.trim().length >= siteSettings.min_search_term_length;
  } else {
    return false;
  }
}

export function applySearchAutocomplete(
  $input,
  siteSettings,
  appEvents,
  options
) {
  const afterComplete = function () {
    if (appEvents) {
      appEvents.trigger("search-autocomplete:after-complete");
    }
  };

  $input.autocomplete(
    deepMerge(
      {
        template: findRawTemplate("category-tag-autocomplete"),
        key: "#",
        width: "100%",
        treatAsTextarea: true,
        transformComplete(obj) {
          return obj.text;
        },
        dataSource(term) {
          return searchCategoryTag(term, siteSettings);
        },
        afterComplete,
      },
      options
    )
  );

  if (siteSettings.enable_mentions) {
    $input.autocomplete(
      deepMerge(
        {
          template: findRawTemplate("user-selector-autocomplete"),
          key: "@",
          width: "100%",
          treatAsTextarea: true,
          transformComplete: (v) => v.username || v.name,
          dataSource: (term) => userSearch({ term, includeGroups: true }),
          afterComplete,
        },
        options
      )
    );
  }
}
