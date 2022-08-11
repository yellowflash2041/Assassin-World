import { cached } from "@glimmer/tracking";

import { getOwner } from "discourse-common/lib/get-owner";
import Component from "@glimmer/component";
import { bind } from "discourse-common/utils/decorators";
import GroupMessageSectionLink from "discourse/lib/sidebar/messages-section/group-message-section-link";
import PersonalMessageSectionLink from "discourse/lib/sidebar/messages-section/personal-message-section-link";
import { inject as service } from "@ember/service";

export const INBOX = "inbox";
export const UNREAD = "unread";
const SENT = "sent";
export const NEW = "new";
const ARCHIVE = "archive";

export const PERSONAL_MESSAGES_INBOX_FILTERS = [
  INBOX,
  NEW,
  UNREAD,
  SENT,
  ARCHIVE,
];

export const GROUP_MESSAGES_INBOX_FILTERS = [INBOX, NEW, UNREAD, ARCHIVE];

export default class SidebarMessagesSection extends Component {
  @service appEvents;
  @service pmTopicTrackingState;
  @service currentUser;

  constructor() {
    super(...arguments);

    this.appEvents.on(
      "page:changed",
      this,
      this._refreshSectionLinksDisplayState
    );

    this.pmTopicTrackingState
      .startTracking()
      .then(this._refreshSectionLinkCounts);

    this._pmTopicTrackingStateKey = "messages-section";

    this.pmTopicTrackingState.onStateChange(
      this._pmTopicTrackingStateKey,
      this._refreshSectionLinkCounts
    );
  }

  @bind
  _refreshSectionLinkCounts() {
    for (const sectionLink of this.allSectionLinks) {
      sectionLink.refreshCount();
    }
  }

  willDestroy() {
    this.appEvents.off(
      "page:changed",
      this,
      this._refreshSectionLinksDisplayState
    );

    this.pmTopicTrackingState.offStateChange(
      this._pmTopicTrackingStateKey,
      this._refreshSectionLinkCounts
    );
  }

  _refreshSectionLinksDisplayState({
    currentRouteName,
    currentRouteParentName,
    currentRouteParams,
  }) {
    if (
      currentRouteParentName !== "userPrivateMessages" &&
      currentRouteParentName !== "topic"
    ) {
      for (const sectionLink of this.allSectionLinks) {
        sectionLink.collapse();
      }
    } else {
      const attrs = {
        currentRouteName,
        currentRouteParams,
      };

      if (currentRouteParentName === "topic") {
        const topicController = getOwner(this).lookup("controller:topic");

        if (topicController.model.isPrivateMessage) {
          attrs.privateMessageTopic = topicController.model;
        }
      }

      for (const sectionLink of this.allSectionLinks) {
        sectionLink.pageChanged(attrs);
      }
    }
  }

  @cached
  get personalMessagesSectionLinks() {
    const links = [];

    PERSONAL_MESSAGES_INBOX_FILTERS.forEach((type) => {
      links.push(
        new PersonalMessageSectionLink({
          currentUser: this.currentUser,
          type,
          pmTopicTrackingState: this.pmTopicTrackingState,
        })
      );
    });

    return links;
  }

  @cached
  get groupMessagesSectionLinks() {
    const links = [];

    this.currentUser.groupsWithMessages.forEach((group) => {
      GROUP_MESSAGES_INBOX_FILTERS.forEach((groupMessageLink) => {
        links.push(
          new GroupMessageSectionLink({
            group,
            type: groupMessageLink,
            currentUser: this.currentUser,
            pmTopicTrackingState: this.pmTopicTrackingState,
          })
        );
      });
    });

    return links;
  }

  get allSectionLinks() {
    return [
      ...this.groupMessagesSectionLinks,
      ...this.personalMessagesSectionLinks,
    ];
  }
}
