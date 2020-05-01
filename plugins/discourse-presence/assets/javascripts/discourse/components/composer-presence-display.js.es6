import Component from "@ember/component";
import { getOwner } from "@ember/application";
import { cancel } from "@ember/runloop";
import { equal, gt } from "@ember/object/computed";
import discourseComputed, {
  observes,
  on
} from "discourse-common/utils/decorators";
import {
  REPLYING,
  CLOSED,
  EDITING,
  COMPOSER_TYPE
} from "../lib/presence-manager";
import { REPLY, EDIT } from "discourse/models/composer";

export default Component.extend({
  // Passed in variables
  action: null,
  post: null,
  topic: null,
  reply: null,
  title: null,
  isWhispering: null,
  presenceManager: null,

  init() {
    this._super(...arguments);

    this.setProperties({
      presenceManager: getOwner(this).lookup("presence-manager:main")
    });
  },

  @discourseComputed("topic.id")
  users(topicId) {
    return this.presenceManager.users(topicId);
  },

  @discourseComputed("topic.id")
  editingUsers(topicId) {
    return this.presenceManager.editingUsers(topicId);
  },

  isReply: equal("action", "reply"),

  @on("didInsertElement")
  subscribe() {
    this.presenceManager.subscribe(this.get("topic.id"), COMPOSER_TYPE);
  },

  @discourseComputed(
    "post.id",
    "editingUsers.@each.last_seen",
    "users.@each.last_seen",
    "action"
  )
  presenceUsers(postId, editingUsers, users, action) {
    if (action === EDIT) {
      return editingUsers.filterBy("post_id", postId);
    } else if (action === REPLY) {
      return users;
    }
    return [];
  },

  shouldDisplay: gt("presenceUsers.length", 0),

  @observes("reply", "title")
  typing() {
    const action = this.action;

    if (action !== REPLY && action !== EDIT) {
      return;
    }

    let data = {
      topicId: this.get("topic.id"),
      state: action === EDIT ? EDITING : REPLYING,
      whisper: this.whisper,
      postId: this.get("post.id")
    };

    this._prevPublishData = data;

    this._throttle = this.presenceManager.throttlePublish(
      data.topicId,
      data.state,
      data.whisper,
      data.postId
    );
  },

  @observes("whisper")
  cancelThrottle() {
    this._cancelThrottle();
  },

  @observes("action", "topic.id")
  composerState() {
    if (this._prevPublishData) {
      this.presenceManager.publish(
        this._prevPublishData.topicId,
        CLOSED,
        this._prevPublishData.whisper,
        this._prevPublishData.postId
      );
      this._prevPublishData = null;
    }
  },

  @on("willDestroyElement")
  closeComposer() {
    this._cancelThrottle();
    this._prevPublishData = null;
    this.presenceManager.cleanUpPresence(COMPOSER_TYPE);
  },

  _cancelThrottle() {
    if (this._throttle) {
      cancel(this._throttle);
      this._throttle = null;
    }
  }
});
