import Controller, { inject as controller } from "@ember/controller";
import { action } from "@ember/object";
import { alias, and, equal } from "@ember/object/computed";
import discourseComputed from "discourse-common/utils/decorators";
import { VIEW_NAME_WARNINGS } from "discourse/routes/user-private-messages-warnings";
import I18n from "I18n";

export const PERSONAL_INBOX = "__personal_inbox__";
const ALL_INBOX = "__all_inbox__";

export default Controller.extend({
  user: controller(),

  pmView: false,
  viewingSelf: alias("user.viewingSelf"),
  isGroup: equal("pmView", "groups"),
  group: null,
  groupFilter: alias("group.name"),
  currentPath: alias("router._router.currentPath"),
  pmTaggingEnabled: alias("site.can_tag_pms"),
  tagId: null,

  showNewPM: and("user.viewingSelf", "currentUser.can_send_private_messages"),

  @discourseComputed("inboxes", "isAllInbox")
  displayGlobalFilters(inboxes, isAllInbox) {
    if (inboxes.length === 0) {
      return true;
    }
    if (inboxes.length && isAllInbox) {
      return true;
    }
    return false;
  },

  @discourseComputed("inboxes")
  sectionClass(inboxes) {
    const defaultClass = "user-secondary-navigation user-messages";

    return inboxes.length
      ? `${defaultClass} user-messages-inboxes`
      : defaultClass;
  },

  @discourseComputed("pmView")
  isPersonalInbox(pmView) {
    return pmView && pmView.startsWith("user");
  },

  @discourseComputed("isPersonalInbox", "group.name")
  isAllInbox(isPersonalInbox, groupName) {
    return !this.isPersonalInbox && !groupName;
  },

  @discourseComputed("isPersonalInbox", "group.name")
  selectedInbox(isPersonalInbox, groupName) {
    if (groupName) {
      return groupName;
    }

    return isPersonalInbox ? PERSONAL_INBOX : ALL_INBOX;
  },

  @discourseComputed("viewingSelf", "pmView", "currentUser.admin")
  showWarningsWarning(viewingSelf, pmView, isAdmin) {
    return pmView === VIEW_NAME_WARNINGS && !viewingSelf && !isAdmin;
  },

  @discourseComputed("pmTopicTrackingState.newIncoming.[]", "selectedInbox")
  newLinkText() {
    return this._linkText("new");
  },

  @discourseComputed("selectedInbox", "pmTopicTrackingState.newIncoming.[]")
  unreadLinkText() {
    return this._linkText("unread");
  },

  _linkText(type) {
    const count = this.pmTopicTrackingState?.lookupCount(type) || 0;

    if (count === 0) {
      return I18n.t(`user.messages.${type}`);
    } else {
      return I18n.t(`user.messages.${type}_with_count`, { count });
    }
  },

  @discourseComputed("model.groupsWithMessages")
  inboxes(groupsWithMessages) {
    if (!groupsWithMessages || groupsWithMessages.length === 0) {
      return [];
    }

    const inboxes = [];

    inboxes.push({
      id: ALL_INBOX,
      name: I18n.t("user.messages.all"),
    });

    inboxes.push({
      id: PERSONAL_INBOX,
      name: I18n.t("user.messages.personal"),
      icon: "envelope",
    });

    groupsWithMessages.forEach((group) => {
      inboxes.push({ id: group.name, name: group.name, icon: "users" });
    });

    return inboxes;
  },

  @action
  changeGroupNotificationLevel(notificationLevel) {
    this.group.setNotification(notificationLevel, this.get("user.model.id"));
  },

  @action
  updateInbox(inbox) {
    if (inbox === ALL_INBOX) {
      this.transitionToRoute("userPrivateMessages.index");
    } else if (inbox === PERSONAL_INBOX) {
      this.transitionToRoute("userPrivateMessages.personal");
    } else {
      this.transitionToRoute("userPrivateMessages.group", inbox);
    }
  },
});
