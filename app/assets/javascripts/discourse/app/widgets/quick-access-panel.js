import I18n from "I18n";
import { Promise } from "rsvp";
import Session from "discourse/models/session";
import { createWidget } from "discourse/widgets/widget";
import { h } from "virtual-dom";

/**
 * This tries to enforce a consistent flow of fetching, caching, refreshing,
 * and rendering for "quick access items".
 *
 * There are parts to introducing a new quick access panel:
 * 1. A user menu link that sends a `quickAccess` action, with a unique `type`.
 * 2. A `quick-access-${type}` widget, extended from `quick-access-panel`.
 */
export default createWidget("quick-access-panel", {
  tagName: "div.quick-access-panel",
  emptyStatePlaceholderItemKey: "",

  buildKey: () => {
    throw Error('Cannot attach abstract widget "quick-access-panel".');
  },

  markReadRequest() {
    return Promise.resolve();
  },

  hideBottomItems() {
    return false;
  },

  hasUnread() {
    return false;
  },

  showAllHref() {
    return "";
  },

  findNewItems() {
    return Promise.resolve([]);
  },

  newItemsLoaded() {},

  itemHtml(item) {}, // eslint-disable-line no-unused-vars

  emptyStatePlaceholderItem() {
    if (this.emptyStatePlaceholderItemKey) {
      return h("li.read", I18n.t(this.emptyStatePlaceholderItemKey));
    } else {
      return "";
    }
  },

  defaultState() {
    return { items: [], loading: false, loaded: false };
  },

  markRead() {
    return this.markReadRequest().then(() => {
      this.refreshNotifications(this.state);
    });
  },

  refreshNotifications(state) {
    if (this.loading) {
      return;
    }

    if (this.getItems().length === 0) {
      state.loading = true;
    }

    this.findNewItems()
      .then((newItems) => this.setItems(newItems))
      .catch(() => this.setItems([]))
      .finally(() => {
        state.loading = false;
        state.loaded = true;
        this.newItemsLoaded();
        this.sendWidgetAction("itemsLoaded", {
          hasUnread: this.hasUnread(),
          markRead: () => this.markRead(),
        });
        this.scheduleRerender();
      });
  },

  html(attrs, state) {
    if (!state.loaded) {
      this.refreshNotifications(state);
    }

    if (state.loading) {
      return [h("div.spinner-container", h("div.spinner"))];
    }

    let bottomItems = [];
    const items = this.getItems().length
      ? this.getItems().map((item) => this.itemHtml(item))
      : [this.emptyStatePlaceholderItem()];

    if (!this.hideBottomItems()) {
      bottomItems.push(
        // intentionally a link so it can be ctrl clicked
        this.attach("link", {
          title: "view_all",
          icon: "chevron-down",
          className: "btn btn-default btn-icon no-text show-all",
          href: this.showAllHref(),
        })
      );
    }

    if (this.hasUnread()) {
      bottomItems.push(
        this.attach("button", {
          title: "user.dismiss_notifications_tooltip",
          icon: "check",
          label: "user.dismiss",
          className: "notifications-dismiss",
          action: "dismissNotifications",
        })
      );
    }

    return [h("ul", items), h("div.panel-body-bottom", bottomItems)];
  },

  getItems() {
    return Session.currentProp(`${this.key}-items`) || [];
  },

  setItems(newItems) {
    Session.currentProp(`${this.key}-items`, newItems);
  },
});
