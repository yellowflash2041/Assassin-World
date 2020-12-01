import { REMINDER_TYPES, formattedReminderTime } from "discourse/lib/bookmark";
import { and, or } from "@ember/object/computed";
import { isEmpty, isPresent } from "@ember/utils";
import { next, schedule } from "@ember/runloop";
import { AUTO_DELETE_PREFERENCES } from "discourse/models/bookmark";
import Controller from "@ember/controller";
import I18n from "I18n";
import KeyboardShortcuts from "discourse/lib/keyboard-shortcuts";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { Promise } from "rsvp";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import bootbox from "bootbox";
import discourseComputed from "discourse-common/utils/decorators";
import { popupAjaxError } from "discourse/lib/ajax-error";

// global shortcuts that interfere with these modal shortcuts, they are rebound when the
// modal is closed
//
// c createTopic
// r replyToPost
// l toggle like
// d deletePost
// t replyAsNewTopic
const GLOBAL_SHORTCUTS_TO_PAUSE = ["c", "r", "l", "d", "t"];
const START_OF_DAY_HOUR = 8;
const LATER_TODAY_CUTOFF_HOUR = 17;
const LATER_TODAY_MAX_HOUR = 18;
const MOMENT_MONDAY = 1;
const MOMENT_THURSDAY = 4;
const BOOKMARK_BINDINGS = {
  enter: { handler: "saveAndClose" },
  "l t": { handler: "selectReminderType", args: [REMINDER_TYPES.LATER_TODAY] },
  "l w": {
    handler: "selectReminderType",
    args: [REMINDER_TYPES.LATER_THIS_WEEK],
  },
  "n b d": {
    handler: "selectReminderType",
    args: [REMINDER_TYPES.NEXT_BUSINESS_DAY],
  },
  "n d": { handler: "selectReminderType", args: [REMINDER_TYPES.TOMORROW] },
  "n w": { handler: "selectReminderType", args: [REMINDER_TYPES.NEXT_WEEK] },
  "n b w": {
    handler: "selectReminderType",
    args: [REMINDER_TYPES.START_OF_NEXT_BUSINESS_WEEK],
  },
  "n m": { handler: "selectReminderType", args: [REMINDER_TYPES.NEXT_MONTH] },
  "c r": { handler: "selectReminderType", args: [REMINDER_TYPES.CUSTOM] },
  "n r": { handler: "selectReminderType", args: [REMINDER_TYPES.NONE] },
  "d d": { handler: "delete" },
};

export default Controller.extend(ModalFunctionality, {
  loading: false,
  errorMessage: null,
  selectedReminderType: null,
  _closeWithoutSaving: false,
  _savingBookmarkManually: false,
  onCloseWithoutSaving: null,
  customReminderDate: null,
  customReminderTime: null,
  lastCustomReminderDate: null,
  lastCustomReminderTime: null,
  postDetectedLocalDate: null,
  postDetectedLocalTime: null,
  mouseTrap: null,
  userTimezone: null,
  showOptions: false,

  onShow() {
    this.setProperties({
      errorMessage: null,
      selectedReminderType: REMINDER_TYPES.NONE,
      _closeWithoutSaving: false,
      _savingBookmarkManually: false,
      customReminderDate: null,
      customReminderTime: this._defaultCustomReminderTime(),
      lastCustomReminderDate: null,
      lastCustomReminderTime: null,
      postDetectedLocalDate: null,
      postDetectedLocalTime: null,
      userTimezone: this.currentUser.resolvedTimezone(this.currentUser),
      showOptions: false,
      model: this.model || {},
    });

    this._loadBookmarkOptions();
    this._bindKeyboardShortcuts();
    this._loadLastUsedCustomReminderDatetime();

    if (this._editingExistingBookmark()) {
      this._initializeExistingBookmarkData();
    }

    schedule("afterRender", () => {
      if (this.site.isMobileDevice) {
        document.getElementById("bookmark-name").blur();
      }
    });
  },

  /**
   * We always want to save the bookmark unless the user specifically
   * clicks the save or cancel button to mimic browser behaviour.
   */
  onClose(opts = {}) {
    if (opts.initiatedByCloseButton) {
      this._closeWithoutSaving = true;
    }

    this._unbindKeyboardShortcuts();
    this._restoreGlobalShortcuts();
    if (!this._closeWithoutSaving && !this._savingBookmarkManually) {
      this._saveBookmark().catch((e) => this._handleSaveError(e));
    }
    if (this.onCloseWithoutSaving && this._closeWithoutSaving) {
      this.onCloseWithoutSaving();
    }
  },

  _initializeExistingBookmarkData() {
    if (this._existingBookmarkHasReminder()) {
      let parsedReminderAt = this._parseCustomDateTime(this.model.reminderAt);

      if (parsedReminderAt.isSame(this.laterToday())) {
        return this.set("selectedReminderType", REMINDER_TYPES.LATER_TODAY);
      }

      this.setProperties({
        customReminderDate: parsedReminderAt.format("YYYY-MM-DD"),
        customReminderTime: parsedReminderAt.format("HH:mm"),
        selectedReminderType: REMINDER_TYPES.CUSTOM,
      });
    }
  },

  _editingExistingBookmark() {
    return isPresent(this.model) && isPresent(this.model.id);
  },

  _existingBookmarkHasReminder() {
    return isPresent(this.model) && isPresent(this.model.reminderAt);
  },

  _loadBookmarkOptions() {
    this.set(
      "autoDeletePreference",
      this.model.autoDeletePreference || this._preferredDeleteOption() || 0
    );

    // we want to make sure the options panel opens so the user
    // knows they have set these options previously. run next otherwise
    // the modal is not visible when it tries to slide down the options
    if (this.autoDeletePreference) {
      next(() => this.toggleOptionsPanel());
    }
  },

  _preferredDeleteOption() {
    let preferred = localStorage.bookmarkDeleteOption;
    if (preferred && preferred !== "") {
      preferred = parseInt(preferred, 10);
    }
    return preferred;
  },

  _loadLastUsedCustomReminderDatetime() {
    let lastTime = localStorage.lastCustomBookmarkReminderTime;
    let lastDate = localStorage.lastCustomBookmarkReminderDate;

    if (lastTime && lastDate) {
      let parsed = this._parseCustomDateTime(lastDate, lastTime);

      // can't set reminders in the past
      if (parsed < this.now()) {
        return;
      }

      this.setProperties({
        lastCustomReminderDate: lastDate,
        lastCustomReminderTime: lastTime,
        parsedLastCustomReminderDatetime: parsed,
      });
    }
  },

  _bindKeyboardShortcuts() {
    KeyboardShortcuts.pause(GLOBAL_SHORTCUTS_TO_PAUSE);
    Object.keys(BOOKMARK_BINDINGS).forEach((shortcut) => {
      KeyboardShortcuts.addShortcut(shortcut, () => {
        let binding = BOOKMARK_BINDINGS[shortcut];
        if (binding.args) {
          return this.send(binding.handler, ...binding.args);
        }
        this.send(binding.handler);
      });
    });
  },

  _unbindKeyboardShortcuts() {
    KeyboardShortcuts.unbind(BOOKMARK_BINDINGS);
  },

  _restoreGlobalShortcuts() {
    KeyboardShortcuts.unpause(GLOBAL_SHORTCUTS_TO_PAUSE);
  },

  @discourseComputed("model.reminderAt")
  showExistingReminderAt(existingReminderAt) {
    return isPresent(existingReminderAt);
  },

  @discourseComputed("model.id")
  showDelete(id) {
    return isPresent(id);
  },

  @discourseComputed("selectedReminderType")
  customDateTimeSelected(selectedReminderType) {
    return selectedReminderType === REMINDER_TYPES.CUSTOM;
  },

  @discourseComputed()
  reminderTypes: () => {
    return REMINDER_TYPES;
  },

  @discourseComputed()
  autoDeletePreferences: () => {
    return Object.keys(AUTO_DELETE_PREFERENCES).map((key) => {
      return {
        id: AUTO_DELETE_PREFERENCES[key],
        name: I18n.t(`bookmarks.auto_delete_preference.${key.toLowerCase()}`),
      };
    });
  },

  showLastCustom: and("lastCustomReminderTime", "lastCustomReminderDate"),

  showPostLocalDate: or(
    "model.postDetectedLocalDate",
    "model.postDetectedLocalTime"
  ),

  get showLaterToday() {
    let later = this.laterToday();
    return (
      !later.isSame(this.tomorrow(), "date") &&
      this.now().hour() < LATER_TODAY_CUTOFF_HOUR
    );
  },

  get showLaterThisWeek() {
    return this.now().day() < MOMENT_THURSDAY;
  },

  @discourseComputed("parsedLastCustomReminderDatetime")
  lastCustomFormatted(parsedLastCustomReminderDatetime) {
    return parsedLastCustomReminderDatetime.format(
      I18n.t("dates.long_no_year")
    );
  },

  @discourseComputed("model.reminderAt")
  existingReminderAtFormatted(existingReminderAt) {
    return formattedReminderTime(existingReminderAt, this.userTimezone);
  },

  get startNextBusinessWeekLabel() {
    if (this.now().day() === MOMENT_MONDAY) {
      return I18n.t("bookmarks.reminders.start_of_next_business_week_alt");
    }
    return I18n.t("bookmarks.reminders.start_of_next_business_week");
  },

  get startNextBusinessWeekFormatted() {
    return this.nextWeek()
      .day(MOMENT_MONDAY)
      .format(I18n.t("dates.long_no_year"));
  },

  get laterTodayFormatted() {
    return this.laterToday().format(I18n.t("dates.time"));
  },

  get tomorrowFormatted() {
    return this.tomorrow().format(I18n.t("dates.time_short_day"));
  },

  get nextWeekFormatted() {
    return this.nextWeek().format(I18n.t("dates.long_no_year"));
  },

  get laterThisWeekFormatted() {
    return this.laterThisWeek().format(I18n.t("dates.time_short_day"));
  },

  get nextMonthFormatted() {
    return this.nextMonth().format(I18n.t("dates.long_no_year"));
  },

  get postLocalDateFormatted() {
    return this.postLocalDate().format(I18n.t("dates.long_no_year"));
  },

  @discourseComputed("userTimezone")
  userHasTimezoneSet(userTimezone) {
    return !isEmpty(userTimezone);
  },

  _saveBookmark() {
    const reminderAt = this._reminderAt();
    const reminderAtISO = reminderAt ? reminderAt.toISOString() : null;

    if (this.selectedReminderType === REMINDER_TYPES.CUSTOM) {
      if (!reminderAt) {
        return Promise.reject(I18n.t("bookmarks.invalid_custom_datetime"));
      }

      localStorage.lastCustomBookmarkReminderTime = this.customReminderTime;
      localStorage.lastCustomBookmarkReminderDate = this.customReminderDate;
    }

    localStorage.bookmarkDeleteOption = this.autoDeletePreference;

    let reminderType;
    if (this.selectedReminderType === REMINDER_TYPES.NONE) {
      reminderType = null;
    } else if (
      this.selectedReminderType === REMINDER_TYPES.LAST_CUSTOM ||
      this.selectedReminderType === REMINDER_TYPES.POST_LOCAL_DATE
    ) {
      reminderType = REMINDER_TYPES.CUSTOM;
    } else {
      reminderType = this.selectedReminderType;
    }

    const data = {
      reminder_type: reminderType,
      reminder_at: reminderAtISO,
      name: this.model.name,
      post_id: this.model.postId,
      id: this.model.id,
      auto_delete_preference: this.autoDeletePreference,
    };

    if (this._editingExistingBookmark()) {
      return ajax("/bookmarks/" + this.model.id, {
        type: "PUT",
        data,
      }).then(() => {
        if (this.afterSave) {
          this.afterSave({
            reminderAt: reminderAtISO,
            reminderType: this.selectedReminderType,
            autoDeletePreference: this.autoDeletePreference,
            id: this.model.id,
            name: this.model.name,
          });
        }
      });
    } else {
      return ajax("/bookmarks", { type: "POST", data }).then((response) => {
        if (this.afterSave) {
          this.afterSave({
            reminderAt: reminderAtISO,
            reminderType: this.selectedReminderType,
            autoDeletePreference: this.autoDeletePreference,
            id: response.id,
            name: this.model.name,
          });
        }
      });
    }
  },

  _deleteBookmark() {
    return ajax("/bookmarks/" + this.model.id, {
      type: "DELETE",
    }).then((response) => {
      if (this.afterDelete) {
        this.afterDelete(response.topic_bookmarked);
      }
    });
  },

  _parseCustomDateTime(date, time) {
    let dateTime = isPresent(time) ? date + " " + time : date;
    return moment.tz(dateTime, this.userTimezone);
  },

  _defaultCustomReminderTime() {
    return `0${START_OF_DAY_HOUR}:00`;
  },

  _reminderAt() {
    if (!this.selectedReminderType) {
      return;
    }

    switch (this.selectedReminderType) {
      case REMINDER_TYPES.LATER_TODAY:
        return this.laterToday();
      case REMINDER_TYPES.NEXT_BUSINESS_DAY:
        return this.nextBusinessDay();
      case REMINDER_TYPES.TOMORROW:
        return this.tomorrow();
      case REMINDER_TYPES.NEXT_WEEK:
        return this.nextWeek();
      case REMINDER_TYPES.START_OF_NEXT_BUSINESS_WEEK:
        return this.nextWeek().day(MOMENT_MONDAY);
      case REMINDER_TYPES.LATER_THIS_WEEK:
        return this.laterThisWeek();
      case REMINDER_TYPES.NEXT_MONTH:
        return this.nextMonth();
      case REMINDER_TYPES.CUSTOM:
        this.set(
          "customReminderTime",
          this.customReminderTime || this._defaultCustomReminderTime()
        );
        const customDateTime = this._parseCustomDateTime(
          this.customReminderDate,
          this.customReminderTime
        );
        if (!customDateTime.isValid()) {
          this.setProperties({
            customReminderTime: null,
            customReminderDate: null,
          });
          return;
        }
        return customDateTime;
      case REMINDER_TYPES.LAST_CUSTOM:
        return this.parsedLastCustomReminderDatetime;
      case REMINDER_TYPES.POST_LOCAL_DATE:
        return this.postLocalDate();
    }
  },

  nextWeek() {
    return this.startOfDay(this.now().add(7, "days"));
  },

  nextMonth() {
    return this.startOfDay(this.now().add(1, "month"));
  },

  postLocalDate() {
    let parsedPostLocalDate = this._parseCustomDateTime(
      this.model.postDetectedLocalDate,
      this.model.postDetectedLocalTime
    );

    if (!this.model.postDetectedLocalTime) {
      return this.startOfDay(parsedPostLocalDate);
    }

    return parsedPostLocalDate;
  },

  tomorrow() {
    return this.startOfDay(this.now().add(1, "day"));
  },

  startOfDay(momentDate) {
    return momentDate.hour(START_OF_DAY_HOUR).startOf("hour");
  },

  now() {
    return moment.tz(this.userTimezone);
  },

  laterToday() {
    let later = this.now().add(3, "hours");
    if (later.hour() >= LATER_TODAY_MAX_HOUR) {
      return later.hour(LATER_TODAY_MAX_HOUR).startOf("hour");
    }
    return later.minutes() < 30
      ? later.startOf("hour")
      : later.add(30, "minutes").startOf("hour");
  },

  laterThisWeek() {
    if (!this.showLaterThisWeek) {
      return;
    }
    return this.startOfDay(this.now().add(2, "days"));
  },

  _handleSaveError(e) {
    this._savingBookmarkManually = false;
    if (typeof e === "string") {
      bootbox.alert(e);
    } else {
      popupAjaxError(e);
    }
  },

  @action
  toggleOptionsPanel() {
    if (this.showOptions) {
      $(".bookmark-options-panel").slideUp("fast");
    } else {
      $(".bookmark-options-panel").slideDown("fast");
    }
    this.toggleProperty("showOptions");
  },

  @action
  saveAndClose() {
    if (this._saving || this._deleting) {
      return;
    }

    this._saving = true;
    this._savingBookmarkManually = true;
    return this._saveBookmark()
      .then(() => this.send("closeModal"))
      .catch((e) => this._handleSaveError(e))
      .finally(() => (this._saving = false));
  },

  @action
  delete() {
    this._deleting = true;
    let deleteAction = () => {
      this._closeWithoutSaving = true;
      this._deleteBookmark()
        .then(() => {
          this._deleting = false;
          this.send("closeModal");
        })
        .catch((e) => this._handleSaveError(e));
    };

    if (this._existingBookmarkHasReminder()) {
      bootbox.confirm(I18n.t("bookmarks.confirm_delete"), (result) => {
        if (result) {
          deleteAction();
        }
      });
    } else {
      deleteAction();
    }
  },

  @action
  closeWithoutSavingBookmark() {
    this._closeWithoutSaving = true;
    this.send("closeModal");
  },

  @action
  selectReminderType(type) {
    if (type === REMINDER_TYPES.LATER_TODAY && !this.showLaterToday) {
      return;
    }

    this.set("selectedReminderType", type);

    if (type !== REMINDER_TYPES.CUSTOM) {
      return this.saveAndClose();
    }
  },
});
