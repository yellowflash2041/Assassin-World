import UserMenuNotificationsList from "discourse/components/user-menu/notifications-list";

export default class UserMenuRepliesNotificationsList extends UserMenuNotificationsList {
  get dismissTypes() {
    return this.filterByTypes;
  }

  dismissWarningModal() {
    return null;
  }
}
