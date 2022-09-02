import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { NO_REMINDER_ICON } from "discourse/models/bookmark";
import UserMenuTab, { CUSTOM_TABS_CLASSES } from "discourse/lib/user-menu/tab";
import { inject as service } from "@ember/service";

const DEFAULT_TAB_ID = "all-notifications";
const DEFAULT_PANEL_COMPONENT = "user-menu/notifications-list";

const REVIEW_QUEUE_TAB_ID = "review-queue";

const CORE_TOP_TABS = [
  class extends UserMenuTab {
    get id() {
      return DEFAULT_TAB_ID;
    }

    get icon() {
      return "bell";
    }

    get panelComponent() {
      return DEFAULT_PANEL_COMPONENT;
    }
  },

  class extends UserMenuTab {
    get id() {
      return "replies";
    }

    get icon() {
      return "reply";
    }

    get panelComponent() {
      return "user-menu/replies-notifications-list";
    }

    get count() {
      return this.getUnreadCountForType("replied");
    }

    get notificationTypes() {
      return ["replied"];
    }
  },

  class extends UserMenuTab {
    get id() {
      return "mentions";
    }

    get icon() {
      return "at";
    }

    get panelComponent() {
      return "user-menu/mentions-notifications-list";
    }

    get count() {
      return this.getUnreadCountForType("mentioned");
    }

    get notificationTypes() {
      return ["mentioned"];
    }
  },

  class extends UserMenuTab {
    get id() {
      return "likes";
    }

    get icon() {
      return "heart";
    }

    get panelComponent() {
      return "user-menu/likes-notifications-list";
    }

    get shouldDisplay() {
      return !this.currentUser.likes_notifications_disabled;
    }

    get count() {
      return this.getUnreadCountForType("liked");
    }

    // TODO(osama): reaction is a type used by the reactions plugin, but it's
    // added here temporarily unitl we add a plugin API for extending
    // filterByTypes in lists
    get notificationTypes() {
      return ["liked", "liked_consolidated", "reaction"];
    }
  },

  class extends UserMenuTab {
    get id() {
      return "messages";
    }

    get icon() {
      return "notification.private_message";
    }

    get panelComponent() {
      return "user-menu/messages-list";
    }

    get count() {
      return this.getUnreadCountForType("private_message");
    }

    get shouldDisplay() {
      return (
        this.siteSettings.enable_personal_messages || this.currentUser.staff
      );
    }
    get notificationTypes() {
      return ["private_message"];
    }
  },

  class extends UserMenuTab {
    get id() {
      return "bookmarks";
    }

    get icon() {
      return NO_REMINDER_ICON;
    }

    get panelComponent() {
      return "user-menu/bookmarks-list";
    }

    get count() {
      return this.getUnreadCountForType("bookmark_reminder");
    }

    get notificationTypes() {
      return ["bookmark_reminder"];
    }
  },

  class extends UserMenuTab {
    get id() {
      return REVIEW_QUEUE_TAB_ID;
    }

    get icon() {
      return "flag";
    }

    get panelComponent() {
      return "user-menu/reviewables-list";
    }

    get shouldDisplay() {
      return this.currentUser.can_review;
    }

    get count() {
      return this.currentUser.get("reviewable_count");
    }
  },
];

const CORE_BOTTOM_TABS = [
  class extends UserMenuTab {
    get id() {
      return "profile";
    }

    get icon() {
      return "user";
    }

    get panelComponent() {
      return "user-menu/profile-tab-content";
    }
  },
];

const CORE_OTHER_NOTIFICATIONS_TAB = class extends UserMenuTab {
  constructor(currentUser, siteSettings, site, otherNotificationTypes) {
    super(...arguments);
    this.otherNotificationTypes = otherNotificationTypes;
  }

  get id() {
    return "other";
  }

  get icon() {
    return "discourse-other-tab";
  }

  get panelComponent() {
    return "user-menu/other-notifications-list";
  }

  get count() {
    return this.otherNotificationTypes.reduce((sum, notificationType) => {
      return sum + this.getUnreadCountForType(notificationType);
    }, 0);
  }

  get notificationTypes() {
    return this.otherNotificationTypes;
  }
};

export default class UserMenu extends Component {
  @service currentUser;
  @service siteSettings;
  @service site;
  @service appEvents;

  @tracked currentTabId = DEFAULT_TAB_ID;
  @tracked currentPanelComponent = DEFAULT_PANEL_COMPONENT;
  @tracked currentNotificationTypes;

  constructor() {
    super(...arguments);
    this.topTabs = this._topTabs;
    this.bottomTabs = this._bottomTabs;
  }

  get _topTabs() {
    const tabs = [];

    CORE_TOP_TABS.forEach((tabClass) => {
      const tab = new tabClass(this.currentUser, this.siteSettings, this.site);
      if (tab.shouldDisplay) {
        tabs.push(tab);
      }
    });

    let reviewQueueTabIndex = tabs.findIndex(
      (tab) => tab.id === REVIEW_QUEUE_TAB_ID
    );

    CUSTOM_TABS_CLASSES.forEach((tabClass) => {
      const tab = new tabClass(this.currentUser, this.siteSettings, this.site);
      if (tab.shouldDisplay) {
        if (reviewQueueTabIndex === -1) {
          tabs.push(tab);
        } else {
          tabs.insertAt(reviewQueueTabIndex, tab);
          reviewQueueTabIndex++;
        }
      }
    });

    tabs.push(
      new CORE_OTHER_NOTIFICATIONS_TAB(
        this.currentUser,
        this.siteSettings,
        this.site,
        this.#notificationTypesForTheOtherTab(tabs)
      )
    );

    return tabs.map((tab, index) => {
      tab.position = index;
      return tab;
    });
  }

  get _bottomTabs() {
    const tabs = [];

    CORE_BOTTOM_TABS.forEach((tabClass) => {
      const tab = new tabClass(this.currentUser, this.siteSettings, this.site);
      if (tab.shouldDisplay) {
        tabs.push(tab);
      }
    });

    const topTabsLength = this.topTabs.length;
    return tabs.map((tab, index) => {
      tab.position = index + topTabsLength;
      return tab;
    });
  }

  #notificationTypesForTheOtherTab(tabs) {
    const usedNotificationTypes = tabs
      .filter((tab) => tab.notificationTypes)
      .map((tab) => tab.notificationTypes)
      .flat();
    return Object.keys(this.site.notification_types).filter(
      (notificationType) => !usedNotificationTypes.includes(notificationType)
    );
  }

  @action
  changeTab(tab) {
    if (this.currentTabId !== tab.id) {
      this.currentTabId = tab.id;
      this.currentPanelComponent = tab.panelComponent;
      this.currentNotificationTypes = tab.notificationTypes;
    }
  }

  @action
  triggerRenderedAppEvent() {
    this.appEvents.trigger("user-menu:rendered");
  }
}
