import {
  BUMP_TYPE,
  CLOSE_AFTER_LAST_POST_STATUS_TYPE,
  CLOSE_STATUS_TYPE,
  DELETE_REPLIES_TYPE,
  DELETE_STATUS_TYPE,
  OPEN_STATUS_TYPE,
  PUBLISH_TO_CATEGORY_STATUS_TYPE,
} from "discourse/controllers/edit-topic-timer";
import { FORMAT } from "select-kit/components/future-date-input-selector";
import discourseComputed from "discourse-common/utils/decorators";
import { equal, or, readOnly } from "@ember/object/computed";
import I18n from "I18n";
import { action } from "@ember/object";
import Component from "@ember/component";
import { isEmpty } from "@ember/utils";
import { now, startOfDay, thisWeekend } from "discourse/lib/time-utils";
import KeyboardShortcuts from "discourse/lib/keyboard-shortcuts";
import Mousetrap from "mousetrap";

export default Component.extend({
  statusType: readOnly("topicTimer.status_type"),
  autoOpen: equal("statusType", OPEN_STATUS_TYPE),
  autoClose: equal("statusType", CLOSE_STATUS_TYPE),
  autoCloseAfterLastPost: equal(
    "statusType",
    CLOSE_AFTER_LAST_POST_STATUS_TYPE
  ),
  autoDelete: equal("statusType", DELETE_STATUS_TYPE),
  autoBump: equal("statusType", BUMP_TYPE),
  publishToCategory: equal("statusType", PUBLISH_TO_CATEGORY_STATUS_TYPE),
  autoDeleteReplies: equal("statusType", DELETE_REPLIES_TYPE),
  showTimeOnly: or("autoOpen", "autoDelete", "autoBump"),
  showFutureDateInput: or("showTimeOnly", "publishToCategory", "autoClose"),
  useDuration: or(
    "isBasedOnLastPost",
    "autoDeleteReplies",
    "autoCloseAfterLastPost"
  ),
  duration: null,

  init() {
    this._super(...arguments);

    KeyboardShortcuts.pause();
    this._mousetrap = new Mousetrap();

    this.set("duration", this.initialDuration);
  },

  get initialDuration() {
    if (!this.useDuration || !this.topicTimer.duration_minutes) {
      return null;
    } else if (this.durationType === "days") {
      return this.topicTimer.duration_minutes / 60 / 24;
    } else {
      return this.topicTimer.duration_minutes / 60;
    }
  },

  willDestroyElement() {
    this._super(...arguments);
    this._mousetrap.reset();
    KeyboardShortcuts.unpause();
  },

  @discourseComputed("autoDeleteReplies")
  durationType(autoDeleteReplies) {
    return autoDeleteReplies ? "days" : "hours";
  },

  @discourseComputed("topic.visible")
  excludeCategoryId(visible) {
    if (visible) {
      return this.get("topic.category_id");
    }
  },

  @discourseComputed()
  customTimeShortcutOptions() {
    return [
      {
        icon: "bed",
        id: "this_weekend",
        label: "topic.auto_update_input.this_weekend",
        time: thisWeekend(),
        timeFormatKey: "dates.time_short_day",
      },
      {
        icon: "far-clock",
        id: "two_weeks",
        label: "topic.auto_update_input.two_weeks",
        time: startOfDay(now().add(2, "weeks")),
        timeFormatKey: "dates.long_no_year",
      },
      {
        icon: "far-calendar-plus",
        id: "six_months",
        label: "topic.auto_update_input.six_months",
        time: startOfDay(now().add(6, "months")),
        timeFormatKey: "dates.long_no_year",
      },
    ];
  },

  @discourseComputed
  hiddenTimeShortcutOptions() {
    return ["none", "start_of_next_business_week"];
  },

  isCustom: equal("timerType", "custom"),
  isBasedOnLastPost: equal("statusType", "close_after_last_post"),

  @discourseComputed(
    "topicTimer.updateTime",
    "topicTimer.duration_minutes",
    "useDuration"
  )
  executeAt(updateTime, duration, useDuration) {
    if (useDuration) {
      return moment().add(parseFloat(duration), "minutes").format(FORMAT);
    } else {
      return updateTime;
    }
  },

  @discourseComputed(
    "isBasedOnLastPost",
    "topicTimer.duration_minutes",
    "topic.last_posted_at"
  )
  willCloseImmediately(isBasedOnLastPost, duration, lastPostedAt) {
    if (isBasedOnLastPost && duration) {
      let closeDate = moment(lastPostedAt);
      closeDate = closeDate.add(duration, "minutes");
      return closeDate < moment();
    }
  },

  @discourseComputed("isBasedOnLastPost", "topic.last_posted_at")
  willCloseI18n(isBasedOnLastPost, lastPostedAt) {
    if (isBasedOnLastPost) {
      const diff = Math.round(
        (new Date() - new Date(lastPostedAt)) / (1000 * 60 * 60)
      );
      return I18n.t("topic.auto_close_momentarily", { count: diff });
    }
  },

  @discourseComputed("durationType")
  durationLabel(durationType) {
    return I18n.t(`topic.topic_status_update.num_of_${durationType}`);
  },

  @discourseComputed(
    "statusType",
    "isCustom",
    "topicTimer.updateTime",
    "willCloseImmediately",
    "topicTimer.category_id",
    "useDuration",
    "topicTimer.duration_minutes"
  )
  showTopicTimerInfo(
    statusType,
    isCustom,
    updateTime,
    willCloseImmediately,
    categoryId,
    useDuration,
    duration
  ) {
    if (!statusType || willCloseImmediately) {
      return false;
    }

    if (statusType === PUBLISH_TO_CATEGORY_STATUS_TYPE && isEmpty(categoryId)) {
      return false;
    }

    if (isCustom && updateTime) {
      if (moment(updateTime) < moment()) {
        return false;
      }
    } else if (useDuration) {
      return duration;
    }

    return updateTime;
  },

  @action
  onTimeSelected(type, time) {
    this.set("timerType", type);
    this.onChangeInput(type, time);
  },

  @action
  durationChanged(newDurationMins) {
    this.set("topicTimer.duration_minutes", newDurationMins);
  },
});
