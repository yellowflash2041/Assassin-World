import { ajax } from "discourse/lib/ajax";
import { flushMap } from "discourse/models/store";
import RestModel from "discourse/models/rest";
import { propertyEqual, fmt } from "discourse/lib/computed";
import { longDate } from "discourse/lib/formatter";
import { isRTL } from "discourse/lib/text-direction";
import ActionSummary from "discourse/models/action-summary";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { censor } from "pretty-text/censored-words";
import { emojiUnescape } from "discourse/lib/text";
import PreloadStore from "preload-store";
import { userPath } from "discourse/lib/url";
import {
  default as computed,
  observes,
  on
} from "ember-addons/ember-computed-decorators";

export function loadTopicView(topic, args) {
  const topicId = topic.get("id");
  const data = _.merge({}, args);
  const url = `${Discourse.getURL("/t/")}${topicId}`;
  const jsonUrl = (data.nearPost ? `${url}/${data.nearPost}` : url) + ".json";

  delete data.nearPost;
  delete data.__type;
  delete data.store;

  return PreloadStore.getAndRemove(`topic_${topicId}`, () =>
    ajax(jsonUrl, { data })
  ).then(json => {
    topic.updateFromJson(json);
    return json;
  });
}

export const ID_CONSTRAINT = /^\d+$/;

const Topic = RestModel.extend({
  message: null,
  errorLoading: false,

  @computed("last_read_post_number", "highest_post_number")
  visited(lastReadPostNumber, highestPostNumber) {
    // >= to handle case where there are deleted posts at the end of the topic
    return lastReadPostNumber >= highestPostNumber;
  },

  @computed("posters.firstObject")
  creator(poster) {
    return poster && poster.user;
  },

  @computed("posters.[]")
  lastPoster(posters) {
    let user;
    if (posters && posters.length > 0) {
      const latest = posters.filter(
        p => p.extras && p.extras.indexOf("latest") >= 0
      )[0];
      user = latest && latest.user;
    }
    return user || this.get("creator");
  },

  @computed("posters.[]", "participants.[]")
  featuredUsers(posters, participants) {
    let users = posters;
    const maxUserCount = 5;
    const posterCount = users.length;

    if (
      this.get("isPrivateMessage") &&
      participants &&
      posterCount < maxUserCount
    ) {
      let pushOffset = 0;
      if (posterCount > 1) {
        const lastUser = users[posterCount - 1];
        if (lastUser.extras && lastUser.extras.includes("latest")) {
          pushOffset = 1;
        }
      }

      const poster_ids = posters.map(p => p.user && p.user.id).filter(id => id);
      participants.some(p => {
        if (!poster_ids.includes(p.user_id)) {
          users.splice(users.length - pushOffset, 0, p);
          if (users.length === maxUserCount) {
            return true;
          }
        }
        return false;
      });
    }

    return users;
  },

  @computed("fancy_title")
  fancyTitle(title) {
    let fancyTitle = censor(
      emojiUnescape(title || ""),
      Discourse.Site.currentProp("censored_words")
    );

    if (Discourse.SiteSettings.support_mixed_text_direction) {
      const titleDir = isRTL(title) ? "rtl" : "ltr";
      return `<span dir="${titleDir}">${fancyTitle}</span>`;
    }
    return fancyTitle;
  },

  // returns createdAt if there's no bumped date
  @computed("bumped_at", "createdAt")
  bumpedAt(bumped_at, createdAt) {
    if (bumped_at) {
      return new Date(bumped_at);
    } else {
      return createdAt;
    }
  },

  @computed("bumpedAt", "createdAt")
  bumpedAtTitle(bumpedAt, createdAt) {
    const firstPost = I18n.t("first_post");
    const lastPost = I18n.t("last_post");
    const createdAtDate = longDate(createdAt);
    const bumpedAtDate = longDate(bumpedAt);

    return `${firstPost}: ${createdAtDate}\n${lastPost}: ${bumpedAtDate}`;
  },

  @computed("created_at")
  createdAt(created_at) {
    return new Date(created_at);
  },

  @computed
  postStream() {
    return this.store.createRecord("postStream", {
      id: this.get("id"),
      topic: this
    });
  },

  @computed("tags")
  visibleListTags(tags) {
    if (!tags || !Discourse.SiteSettings.suppress_overlapping_tags_in_list) {
      return tags;
    }

    const title = this.get("title");
    const newTags = [];

    tags.forEach(function(tag) {
      if (title.toLowerCase().indexOf(tag) === -1) {
        newTags.push(tag);
      }
    });

    return newTags;
  },

  @computed("related_messages")
  relatedMessages(relatedMessages) {
    if (relatedMessages) {
      const store = this.store;

      return this.set(
        "related_messages",
        relatedMessages.map(st => store.createRecord("topic", st))
      );
    }
  },

  @computed("suggested_topics")
  suggestedTopics(suggestedTopics) {
    if (suggestedTopics) {
      const store = this.store;

      return this.set(
        "suggested_topics",
        suggestedTopics.map(st => store.createRecord("topic", st))
      );
    }
  },

  @computed("posts_count")
  replyCount(postsCount) {
    return postsCount - 1;
  },

  @computed
  details() {
    return this.store.createRecord("topicDetails", {
      id: this.get("id"),
      topic: this
    });
  },

  invisible: Ember.computed.not("visible"),
  deleted: Ember.computed.notEmpty("deleted_at"),

  @computed("id")
  searchContext(id) {
    return { type: "topic", id };
  },

  @on("init")
  @observes("category_id")
  _categoryIdChanged() {
    this.set("category", Discourse.Category.findById(this.get("category_id")));
  },

  @observes("categoryName")
  _categoryNameChanged() {
    const categoryName = this.get("categoryName");
    let category;
    if (categoryName) {
      category = this.site.get("categories").findBy("name", categoryName);
    }
    this.set("category", category);
  },

  categoryClass: fmt("category.fullSlug", "category-%@"),

  @computed("tags")
  tagClasses(tags) {
    return tags && tags.map(t => `tag-${t}`).join(" ");
  },

  @computed("url")
  shareUrl(url) {
    const user = Discourse.User.current();
    const userQueryString = user ? `?u=${user.get("username_lower")}` : "";
    return `${url}${userQueryString}`;
  },

  printUrl: fmt("url", "%@/print"),

  @computed("id", "slug")
  url(id, slug) {
    slug = slug || "";
    if (slug.trim().length === 0) {
      slug = "topic";
    }
    return `${Discourse.getURL("/t/")}${slug}/${id}`;
  },

  // Helper to build a Url with a post number
  urlForPostNumber(postNumber) {
    let url = this.get("url");
    if (postNumber && postNumber > 0) {
      url += `/${postNumber}`;
    }
    return url;
  },

  @computed("new_posts", "unread")
  totalUnread(newPosts, unread) {
    const count = (unread || 0) + (newPosts || 0);
    return count > 0 ? count : null;
  },

  @computed("last_read_post_number", "url")
  lastReadUrl(lastReadPostNumber) {
    return this.urlForPostNumber(lastReadPostNumber);
  },

  @computed("last_read_post_number", "highest_post_number", "url")
  lastUnreadUrl(lastReadPostNumber, highestPostNumber) {
    if (highestPostNumber <= lastReadPostNumber) {
      if (this.get("category.navigate_to_first_post_after_read")) {
        return this.urlForPostNumber(1);
      } else {
        return this.urlForPostNumber(lastReadPostNumber + 1);
      }
    } else {
      return this.urlForPostNumber(lastReadPostNumber + 1);
    }
  },

  @computed("highest_post_number", "url")
  lastPostUrl(highestPostNumber) {
    return this.urlForPostNumber(highestPostNumber);
  },

  @computed("url")
  firstPostUrl() {
    return this.urlForPostNumber(1);
  },

  @computed("url")
  summaryUrl() {
    const summaryQueryString = this.get("has_summary") ? "?filter=summary" : "";
    return `${this.urlForPostNumber(1)}${summaryQueryString}`;
  },

  @computed("last_poster.username")
  lastPosterUrl(username) {
    return userPath(username);
  },

  // The amount of new posts to display. It might be different than what the server
  // tells us if we are still asynchronously flushing our "recently read" data.
  // So take what the browser has seen into consideration.
  @computed("new_posts", "id")
  displayNewPosts(newPosts, id) {
    const highestSeen = Discourse.Session.currentProp("highestSeenByTopic")[id];
    if (highestSeen) {
      const delta = highestSeen - this.get("last_read_post_number");
      if (delta > 0) {
        let result = newPosts - delta;
        if (result < 0) {
          result = 0;
        }
        return result;
      }
    }
    return newPosts;
  },

  @computed("views")
  viewsHeat(v) {
    if (v >= Discourse.SiteSettings.topic_views_heat_high) {
      return "heatmap-high";
    }
    if (v >= Discourse.SiteSettings.topic_views_heat_medium) {
      return "heatmap-med";
    }
    if (v >= Discourse.SiteSettings.topic_views_heat_low) {
      return "heatmap-low";
    }
    return null;
  },

  @computed("archetype")
  archetypeObject(archetype) {
    return Discourse.Site.currentProp("archetypes").findBy("id", archetype);
  },

  isPrivateMessage: Ember.computed.equal("archetype", "private_message"),
  isBanner: Ember.computed.equal("archetype", "banner"),

  toggleStatus(property) {
    this.toggleProperty(property);
    return this.saveStatus(property, !!this.get(property));
  },

  saveStatus(property, value, until) {
    if (property === "closed") {
      this.incrementProperty("posts_count");
    }
    return ajax(`${this.get("url")}/status`, {
      type: "PUT",
      data: {
        status: property,
        enabled: !!value,
        until
      }
    });
  },

  makeBanner() {
    return ajax(`/t/${this.get("id")}/make-banner`, { type: "PUT" }).then(() =>
      this.set("archetype", "banner")
    );
  },

  removeBanner() {
    return ajax(`/t/${this.get("id")}/remove-banner`, {
      type: "PUT"
    }).then(() => this.set("archetype", "regular"));
  },

  toggleBookmark() {
    if (this.get("bookmarking")) {
      return Ember.RSVP.Promise.resolve();
    }
    this.set("bookmarking", true);

    const stream = this.get("postStream");
    const posts = Ember.get(stream, "posts");
    const firstPost =
      posts && posts[0] && posts[0].get("post_number") === 1 && posts[0];
    const bookmark = !this.get("bookmarked");
    const path = bookmark ? "/bookmark" : "/remove_bookmarks";

    const toggleBookmarkOnServer = () => {
      return ajax(`/t/${this.get("id")}${path}`, { type: "PUT" })
        .then(() => {
          this.toggleProperty("bookmarked");
          if (bookmark && firstPost) {
            firstPost.set("bookmarked", true);
            return [firstPost.id];
          }
          if (!bookmark && posts) {
            const updated = [];
            posts.forEach(post => {
              if (post.get("bookmarked")) {
                post.set("bookmarked", false);
                updated.push(post.get("id"));
              }
            });
            return updated;
          }

          return [];
        })
        .catch(popupAjaxError)
        .finally(() => this.set("bookmarking", false));
    };

    const unbookmarkedPosts = [];
    if (!bookmark && posts) {
      posts.forEach(
        post => post.get("bookmarked") && unbookmarkedPosts.push(post)
      );
    }

    return new Ember.RSVP.Promise(resolve => {
      if (unbookmarkedPosts.length > 1) {
        bootbox.confirm(
          I18n.t("bookmarks.confirm_clear"),
          I18n.t("no_value"),
          I18n.t("yes_value"),
          confirmed =>
            confirmed ? toggleBookmarkOnServer().then(resolve) : resolve()
        );
      } else {
        toggleBookmarkOnServer().then(resolve);
      }
    });
  },

  createGroupInvite(group) {
    return ajax(`/t/${this.get("id")}/invite-group`, {
      type: "POST",
      data: { group }
    });
  },

  createInvite(user, group_names, custom_message) {
    return ajax(`/t/${this.get("id")}/invite`, {
      type: "POST",
      data: { user, group_names, custom_message }
    });
  },

  generateInviteLink(email, groupNames, topicId) {
    return ajax("/invites/link", {
      type: "POST",
      data: { email, group_names: groupNames, topic_id: topicId }
    });
  },

  // Delete this topic
  destroy(deleted_by) {
    this.setProperties({
      deleted_at: new Date(),
      deleted_by: deleted_by,
      "details.can_delete": false,
      "details.can_recover": true
    });
    return ajax(`/t/${this.get("id")}`, {
      data: { context: window.location.pathname },
      type: "DELETE"
    });
  },

  // Recover this topic if deleted
  recover() {
    this.setProperties({
      deleted_at: null,
      deleted_by: null,
      "details.can_delete": true,
      "details.can_recover": false
    });
    return ajax(`/t/${this.get("id")}/recover`, {
      data: { context: window.location.pathname },
      type: "PUT"
    });
  },

  // Update our attributes from a JSON result
  updateFromJson(json) {
    this.get("details").updateFromJson(json.details);

    const keys = Object.keys(json);
    keys.removeObject("details");
    keys.removeObject("post_stream");

    keys.forEach(key => this.set(key, json[key]));
  },

  reload() {
    return ajax(`/t/${this.get("id")}`, { type: "GET" }).then(topic_json =>
      this.updateFromJson(topic_json)
    );
  },

  isPinnedUncategorized: Ember.computed.and(
    "pinned",
    "category.isUncategorizedCategory"
  ),

  clearPin() {
    // Clear the pin optimistically from the object
    this.setProperties({ pinned: false, unpinned: true });

    ajax(`/t/${this.get("id")}/clear-pin`, {
      type: "PUT"
    }).then(null, () => {
      // On error, put the pin back
      this.setProperties({ pinned: true, unpinned: false });
    });
  },

  togglePinnedForUser() {
    if (this.get("pinned")) {
      this.clearPin();
    } else {
      this.rePin();
    }
  },

  rePin() {
    // Clear the pin optimistically from the object
    this.setProperties({ pinned: true, unpinned: false });

    ajax(`/t/${this.get("id")}/re-pin`, {
      type: "PUT"
    }).then(null, () => {
      // On error, put the pin back
      this.setProperties({ pinned: true, unpinned: false });
    });
  },

  @computed("excerpt")
  escapedExcerpt(excerpt) {
    return emojiUnescape(excerpt);
  },

  hasExcerpt: Ember.computed.notEmpty("excerpt"),

  @computed("excerpt")
  excerptTruncated(excerpt) {
    return excerpt && excerpt.substr(excerpt.length - 8, 8) === "&hellip;";
  },

  readLastPost: propertyEqual("last_read_post_number", "highest_post_number"),
  canClearPin: Ember.computed.and("pinned", "readLastPost"),

  archiveMessage() {
    this.set("archiving", true);
    const promise = ajax(`/t/${this.get("id")}/archive-message`, {
      type: "PUT"
    });

    promise
      .then(msg => {
        this.set("message_archived", true);
        if (msg && msg.group_name) {
          this.set("inboxGroupName", msg.group_name);
        }
      })
      .finally(() => this.set("archiving", false));

    return promise;
  },

  moveToInbox() {
    this.set("archiving", true);
    const promise = ajax(`/t/${this.get("id")}/move-to-inbox`, { type: "PUT" });

    promise
      .then(msg => {
        this.set("message_archived", false);
        if (msg && msg.group_name) {
          this.set("inboxGroupName", msg.group_name);
        }
      })
      .finally(() => this.set("archiving", false));

    return promise;
  },

  publish() {
    return ajax(`/t/${this.get("id")}/publish`, {
      type: "PUT",
      data: this.getProperties("destination_category_id")
    })
      .then(() => this.set("destination_category_id", null))
      .catch(popupAjaxError);
  },

  updateDestinationCategory(categoryId) {
    this.set("destination_category_id", categoryId);
    return ajax(`/t/${this.get("id")}/shared-draft`, {
      method: "PUT",
      data: { category_id: categoryId }
    });
  },

  convertTopic(type) {
    return ajax(`/t/${this.get("id")}/convert-topic/${type}`, { type: "PUT" })
      .then(() => window.location.reload())
      .catch(popupAjaxError);
  },

  resetBumpDate() {
    return ajax(`/t/${this.get("id")}/reset-bump-date`, { type: "PUT" }).catch(
      popupAjaxError
    );
  }
});

Topic.reopenClass({
  NotificationLevel: {
    WATCHING: 3,
    TRACKING: 2,
    REGULAR: 1,
    MUTED: 0
  },

  createActionSummary(result) {
    if (result.actions_summary) {
      const lookup = Ember.Object.create();
      result.actions_summary = result.actions_summary.map(a => {
        a.post = result;
        a.actionType = Discourse.Site.current().postActionTypeById(a.id);
        const actionSummary = ActionSummary.create(a);
        lookup.set(a.actionType.get("name_key"), actionSummary);
        return actionSummary;
      });
      result.set("actionByName", lookup);
    }
  },

  update(topic, props) {
    props = JSON.parse(JSON.stringify(props)) || {};

    // We support `category_id` and `categoryId` for compatibility
    if (typeof props.categoryId !== "undefined") {
      props.category_id = props.categoryId;
      delete props.categoryId;
    }

    // Make sure we never change the category for private messages
    if (topic.get("isPrivateMessage")) {
      delete props.category_id;
    }

    // Annoyingly, empty arrays are not sent across the wire. This
    // allows us to make a distinction between arrays that were not
    // sent and arrays that we specifically want to be empty.
    Object.keys(props).forEach(function(k) {
      const v = props[k];
      if (v instanceof Array && v.length === 0) {
        props[`${k}_empty_array`] = true;
      }
    });

    return ajax(topic.get("url"), { type: "PUT", data: props }).then(result => {
      // The title can be cleaned up server side
      props.title = result.basic_topic.title;
      props.fancy_title = result.basic_topic.fancy_title;
      topic.setProperties(props);
    });
  },

  create() {
    const result = this._super.apply(this, arguments);
    this.createActionSummary(result);
    return result;
  },

  // Load a topic, but accepts a set of filters
  find(topicId, opts) {
    let url = Discourse.getURL("/t/") + topicId;
    if (opts.nearPost) {
      url += `/${opts.nearPost}`;
    }

    const data = {};
    if (opts.postsAfter) {
      data.posts_after = opts.postsAfter;
    }
    if (opts.postsBefore) {
      data.posts_before = opts.postsBefore;
    }
    if (opts.trackVisit) {
      data.track_visit = true;
    }

    // Add username filters if we have them
    if (opts.userFilters && opts.userFilters.length > 0) {
      data.username_filters = [];
      opts.userFilters.forEach(function(username) {
        data.username_filters.push(username);
      });
    }

    // Add the summary of filter if we have it
    if (opts.summary === true) {
      data.summary = true;
    }

    // Check the preload store. If not, load it via JSON
    return ajax(`${url}.json`, { data });
  },

  changeOwners(topicId, opts) {
    const promise = ajax(`/t/${topicId}/change-owner`, {
      type: "POST",
      data: opts
    }).then(result => {
      if (result.success) return result;
      promise.reject(new Error("error changing ownership of posts"));
    });
    return promise;
  },

  changeTimestamp(topicId, timestamp) {
    const promise = ajax(`/t/${topicId}/change-timestamp`, {
      type: "PUT",
      data: { timestamp }
    }).then(result => {
      if (result.success) return result;
      promise.reject(new Error("error updating timestamp of topic"));
    });
    return promise;
  },

  bulkOperation(topics, operation) {
    return ajax("/topics/bulk", {
      type: "PUT",
      data: {
        topic_ids: topics.map(t => t.get("id")),
        operation
      }
    });
  },

  bulkOperationByFilter(filter, operation, categoryId) {
    const data = { filter, operation };
    if (categoryId) data.category_id = categoryId;
    return ajax("/topics/bulk", {
      type: "PUT",
      data
    });
  },

  resetNew() {
    return ajax("/topics/reset-new", { type: "PUT" });
  },

  idForSlug(slug) {
    return ajax(`/t/id_for/${slug}`);
  }
});

function moveResult(result) {
  if (result.success) {
    // We should be hesitant to flush the map but moving ids is one rare case
    flushMap();
    return result;
  }
  throw new Error("error moving posts topic");
}

export function movePosts(topicId, data) {
  return ajax(`/t/${topicId}/move-posts`, { type: "POST", data }).then(
    moveResult
  );
}

export function mergeTopic(topicId, data) {
  return ajax(`/t/${topicId}/merge-topic`, { type: "POST", data }).then(
    moveResult
  );
}

export default Topic;
