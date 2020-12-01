import { alias, empty } from "@ember/object/computed";
import Controller from "@ember/controller";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { Promise } from "rsvp";
import Topic from "discourse/models/topic";
import bootbox from "bootbox";

const _buttons = [];

const alwaysTrue = () => true;

function identity() {}

function addBulkButton(action, key, opts) {
  opts = opts || {};

  const btn = {
    action,
    label: `topics.bulk.${key}`,
    icon: opts.icon,
    buttonVisible: opts.buttonVisible || alwaysTrue,
    enabledSetting: opts.enabledSetting,
    class: opts.class,
  };

  _buttons.push(btn);
}

// Default buttons
addBulkButton("showChangeCategory", "change_category", {
  icon: "pencil-alt",
  class: "btn-default",
});
addBulkButton("closeTopics", "close_topics", {
  icon: "lock",
  class: "btn-default",
});
addBulkButton("archiveTopics", "archive_topics", {
  icon: "folder",
  class: "btn-default",
});
addBulkButton("showNotificationLevel", "notification_level", {
  icon: "d-regular",
  class: "btn-default",
});
addBulkButton("resetRead", "reset_read", {
  icon: "backward",
  class: "btn-default",
});
addBulkButton("unlistTopics", "unlist_topics", {
  icon: "far-eye-slash",
  class: "btn-default",
  buttonVisible: (topics) => topics.some((t) => t.visible),
});
addBulkButton("relistTopics", "relist_topics", {
  icon: "far-eye",
  class: "btn-default",
  buttonVisible: (topics) => topics.some((t) => !t.visible),
});
addBulkButton("showTagTopics", "change_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
});
addBulkButton("showAppendTagTopics", "append_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
});
addBulkButton("removeTags", "remove_tags", {
  icon: "tag",
  class: "btn-default",
  enabledSetting: "tagging_enabled",
});
addBulkButton("deleteTopics", "delete", {
  icon: "trash-alt",
  class: "btn-danger",
});

// Modal for performing bulk actions on topics
export default Controller.extend(ModalFunctionality, {
  tags: null,

  emptyTags: empty("tags"),
  categoryId: alias("model.category.id"),
  processedTopicCount: 0,

  onShow() {
    const topics = this.get("model.topics");
    this.set(
      "buttons",
      _buttons.filter((b) => {
        if (b.enabledSetting && !this.siteSettings[b.enabledSetting]) {
          return false;
        }
        return b.buttonVisible(topics);
      })
    );
    this.set("modal.modalClass", "topic-bulk-actions-modal small");
    this.send("changeBulkTemplate", "modal/bulk-actions-buttons");
  },

  perform(operation) {
    this.set("processedTopicCount", 0);
    this.send("changeBulkTemplate", "modal/bulk-progress");
    this.set("loading", true);

    return this._processChunks(operation)
      .catch(() => {
        bootbox.alert(I18n.t("generic_error"));
      })
      .finally(() => {
        this.set("loading", false);
      });
  },

  _generateTopicChunks(allTopics) {
    let startIndex = 0;
    const chunkSize = 30;
    const chunks = [];

    while (startIndex < allTopics.length) {
      let topics = allTopics.slice(startIndex, startIndex + chunkSize);
      chunks.push(topics);
      startIndex += chunkSize;
    }

    return chunks;
  },

  _processChunks(operation) {
    const allTopics = this.get("model.topics");
    const topicChunks = this._generateTopicChunks(allTopics);
    const topicIds = [];

    const tasks = topicChunks.map((topics) => () => {
      return Topic.bulkOperation(topics, operation).then((result) => {
        this.set(
          "processedTopicCount",
          this.get("processedTopicCount") + topics.length
        );
        return result;
      });
    });

    return new Promise((resolve, reject) => {
      const resolveNextTask = () => {
        if (tasks.length === 0) {
          const topics = topicIds.map((id) => allTopics.findBy("id", id));
          return resolve(topics);
        }

        tasks
          .shift()()
          .then((result) => {
            if (result && result.topic_ids) {
              topicIds.push(...result.topic_ids);
            }
            resolveNextTask();
          })
          .catch(reject);
      };

      resolveNextTask();
    });
  },

  forEachPerformed(operation, cb) {
    this.perform(operation).then((topics) => {
      if (topics) {
        topics.forEach(cb);
        (this.refreshClosure || identity)();
        this.send("closeModal");
      }
    });
  },

  performAndRefresh(operation) {
    return this.perform(operation).then(() => {
      (this.refreshClosure || identity)();
      this.send("closeModal");
    });
  },

  actions: {
    showTagTopics() {
      this.set("tags", "");
      this.set("action", "changeTags");
      this.set("label", "change_tags");
      this.set("title", "choose_new_tags");
      this.send("changeBulkTemplate", "bulk-tag");
    },

    changeTags() {
      this.performAndRefresh({ type: "change_tags", tags: this.tags });
    },

    showAppendTagTopics() {
      this.set("tags", "");
      this.set("action", "appendTags");
      this.set("label", "append_tags");
      this.set("title", "choose_append_tags");
      this.send("changeBulkTemplate", "bulk-tag");
    },

    appendTags() {
      this.performAndRefresh({ type: "append_tags", tags: this.tags });
    },

    showChangeCategory() {
      this.send("changeBulkTemplate", "modal/bulk-change-category");
    },

    showNotificationLevel() {
      this.send("changeBulkTemplate", "modal/bulk-notification-level");
    },

    deleteTopics() {
      this.performAndRefresh({ type: "delete" });
    },

    closeTopics() {
      this.forEachPerformed({ type: "close" }, (t) => t.set("closed", true));
    },

    archiveTopics() {
      this.forEachPerformed({ type: "archive" }, (t) =>
        t.set("archived", true)
      );
    },

    unlistTopics() {
      this.forEachPerformed({ type: "unlist" }, (t) => t.set("visible", false));
    },

    relistTopics() {
      this.forEachPerformed({ type: "relist" }, (t) => t.set("visible", true));
    },

    changeCategory() {
      const categoryId = parseInt(this.newCategoryId, 10) || 0;

      this.perform({ type: "change_category", category_id: categoryId }).then(
        (topics) => {
          topics.forEach((t) => t.set("category_id", categoryId));
          (this.refreshClosure || identity)();
          this.send("closeModal");
        }
      );
    },

    resetRead() {
      this.performAndRefresh({ type: "reset_read" });
    },

    removeTags() {
      this.performAndRefresh({ type: "remove_tags" });
    },
  },
});

export { addBulkButton };
