import I18n from "I18n";

import { capitalize } from "@ember/string";
import MessageSectionLink from "discourse/lib/sidebar/messages-section/message-section-link";

export default class GroupMessageSectionLink extends MessageSectionLink {
  routeNames = new Set([
    "userPrivateMessages.group",
    "userPrivateMessages.groupUnread",
    "userPrivateMessages.groupNew",
    "userPrivateMessages.groupArchive",
  ]);

  get name() {
    return `group-messages-${this.type}`;
  }

  get class() {
    return this.group.name;
  }

  get route() {
    if (this._isInbox) {
      return "userPrivateMessages.group";
    } else {
      return `userPrivateMessages.group${capitalize(this.type)}`;
    }
  }

  get currentWhen() {
    if (this._isInbox) {
      return [...this.routeNames].join(" ");
    }
  }

  get models() {
    return [this.currentUser, this.group.name];
  }

  get text() {
    if (this._isInbox) {
      return this.group.name;
    } else if (this.count > 0) {
      return I18n.t(`sidebar.sections.messages.links.${this.type}_with_count`, {
        count: this.count,
      });
    } else {
      return I18n.t(`sidebar.sections.messages.links.${this.type}`);
    }
  }

  pageChanged({ currentRouteName, currentRouteParams, privateMessageTopic }) {
    if (this._isInbox) {
      return;
    }

    if (
      privateMessageTopic?.allowedGroups?.some(
        (g) => g.name === this.group.name
      )
    ) {
      this.setDisplayState = true;
      return;
    }

    this.setDisplayState =
      this.routeNames.has(currentRouteName) &&
      currentRouteParams.name.toLowerCase() === this.group.name.toLowerCase();
  }
}
