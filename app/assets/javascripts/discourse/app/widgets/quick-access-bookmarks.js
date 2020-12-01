import QuickAccessPanel from "discourse/widgets/quick-access-panel";
import UserAction from "discourse/models/user-action";
import { ajax } from "discourse/lib/ajax";
import { createWidgetFrom } from "discourse/widgets/widget";
import { h } from "virtual-dom";
import { postUrl } from "discourse/lib/utilities";

const ICON = "bookmark";

createWidgetFrom(QuickAccessPanel, "quick-access-bookmarks", {
  buildKey: () => "quick-access-bookmarks",

  showAllHref() {
    return `${this.attrs.path}/activity/bookmarks`;
  },

  emptyStatePlaceholderItem() {
    return h("li.read", this.state.emptyStatePlaceholderItemText);
  },

  findNewItems() {
    return this.loadBookmarksWithReminders();
  },

  itemHtml(bookmark) {
    return this.attach("quick-access-item", {
      icon: this.icon(bookmark),
      href: postUrl(
        bookmark.slug,
        bookmark.topic_id,
        bookmark.post_number || bookmark.linked_post_number
      ),
      content: bookmark.title,
      username: bookmark.post_user_username,
    });
  },

  icon(bookmark) {
    if (bookmark.reminder_at) {
      return "discourse-bookmark-clock";
    }
    return ICON;
  },

  loadBookmarksWithReminders() {
    return ajax(`/u/${this.currentUser.username}/bookmarks.json`, {
      cache: "false",
    }).then((result) => {
      result = result.user_bookmark_list;

      // The empty state help text for bookmarks page is localized on the
      // server.
      if (result.no_results_help) {
        this.state.emptyStatePlaceholderItemText = result.no_results_help;
      }
      return result.bookmarks;
    });
  },

  loadUserActivityBookmarks() {
    return ajax("/user_actions.json", {
      cache: "false",
      data: {
        username: this.currentUser.username,
        filter: UserAction.TYPES.bookmarks,
        no_results_help_key: "user_activity.no_bookmarks",
      },
    }).then(({ user_actions, no_results_help }) => {
      // The empty state help text for bookmarks page is localized on the
      // server.
      this.state.emptyStatePlaceholderItemText = no_results_help;
      return user_actions;
    });
  },
});
