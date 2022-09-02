import { click, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  loggedInUser,
  publishToMessageBus,
  query,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { cloneJSON } from "discourse-common/lib/object";
import { withPluginApi } from "discourse/lib/plugin-api";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import UserMenuFixtures from "discourse/tests/fixtures/user-menu";
import TopicFixtures from "discourse/tests/fixtures/topic";
import { Promise } from "rsvp";
import { later } from "@ember/runloop";
import I18n from "I18n";

acceptance("User menu", function (needs) {
  needs.user({
    redesigned_user_menu_enabled: true,
    unread_high_priority_notifications: 73,
    trust_level: 3,
    grouped_unread_notifications: {
      [NOTIFICATION_TYPES.replied]: 2,
    },
  });

  needs.settings({
    allow_anonymous_posting: true,
    anonymous_posting_min_trust_level: 3,
  });

  let requestHeaders = {};

  needs.pretender((server, helper) => {
    server.get("/t/1234.json", (request) => {
      const json = cloneJSON(TopicFixtures["/t/130.json"]);
      json.id = 1234;
      json.post_stream.posts.forEach((post) => {
        post.topic_id = 1234;
      });
      requestHeaders = request.requestHeaders;
      return helper.response(json);
    });
  });

  needs.hooks.afterEach(() => {
    requestHeaders = {};
  });

  test("clicking on an unread notification", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    let repliesBadgeNotification = query(
      "#user-menu-button-replies .badge-notification"
    );
    assert.strictEqual(
      repliesBadgeNotification.textContent.trim(),
      "2",
      "badge shows the right count"
    );

    await click(".user-menu ul li.replied a");

    assert.strictEqual(
      requestHeaders["Discourse-Clear-Notifications"],
      123, // id is from the fixtures in fixtures/notification-fixtures.js
      "the Discourse-Clear-Notifications request header is set to the notification id in the next ajax request"
    );

    await click(".d-header-icons .current-user");
    repliesBadgeNotification = query(
      "#user-menu-button-replies .badge-notification"
    );
    assert.strictEqual(
      repliesBadgeNotification.textContent.trim(),
      "1",
      "badge shows count reduced by one"
    );
  });

  test("tabs added via the plugin API", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-1";
          }

          get count() {
            return this.currentUser.get("unread_high_priority_notifications");
          }

          get icon() {
            return "wrench";
          }

          get panelComponent() {
            return "d-button";
          }
        };
      });

      api.registerUserMenuTab((UserMenuTab) => {
        return class extends UserMenuTab {
          get id() {
            return "custom-tab-2";
          }

          get count() {
            return 29;
          }

          get icon() {
            return "plus";
          }

          get panelComponent() {
            return "d-button";
          }
        };
      });
    });
    const expectedTabOrder = {
      "user-menu-button-all-notifications": "0",
      "user-menu-button-replies": "1",
      "user-menu-button-mentions": "2",
      "user-menu-button-likes": "3",
      "user-menu-button-messages": "4",
      "user-menu-button-bookmarks": "5",
      "user-menu-button-custom-tab-1": "6",
      "user-menu-button-custom-tab-2": "7",
      "user-menu-button-review-queue": "8",
      "user-menu-button-other": "9",
    };

    await visit("/");
    await click(".d-header-icons .current-user");

    assert.ok(
      exists("#user-menu-button-custom-tab-1"),
      "first custom tab is rendered"
    );
    assert.ok(
      exists("#user-menu-button-custom-tab-2"),
      "second custom tab is rendered"
    );

    const tabs = [...queryAll(".tabs-list.top-tabs .btn")];

    assert.deepEqual(
      tabs.reduce((acc, tab) => {
        acc[tab.id] = tab.dataset.tabNumber;
        return acc;
      }, {}),
      expectedTabOrder,
      "data-tab-number of the tabs has no gaps when custom tabs are added and the tabs are in the right order"
    );
    assert.strictEqual(
      query(".tabs-list.bottom-tabs .btn").dataset.tabNumber,
      "10",
      "bottom tab has the correct data-tab-number"
    );

    let customTab1Bubble = query(
      "#user-menu-button-custom-tab-1 .badge-notification"
    );

    assert.strictEqual(
      customTab1Bubble.textContent.trim(),
      "73",
      "bubble shows the right count"
    );

    const customTab2Bubble = query(
      "#user-menu-button-custom-tab-2 .badge-notification"
    );

    assert.strictEqual(
      customTab2Bubble.textContent.trim(),
      "29",
      "bubble shows the right count"
    );

    await publishToMessageBus(`/notification/${loggedInUser().id}`, {
      unread_high_priority_notifications: 18,
    });

    customTab1Bubble = query(
      "#user-menu-button-custom-tab-1 .badge-notification"
    );

    assert.strictEqual(
      customTab1Bubble.textContent.trim(),
      "18",
      "displayed bubble count updates when the value is changed"
    );

    await click("#user-menu-button-custom-tab-1");

    assert.ok(
      exists("#user-menu-button-custom-tab-1.active"),
      "custom tabs can be clicked on and become active"
    );

    assert.ok(
      exists("#quick-access-custom-tab-1 button.btn"),
      "the tab's content is now displayed in the panel"
    );
  });

  test("notifications tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("notification", (notifications) => {
        notifications.forEach((notification, index) => {
          if (notification.fancy_title) {
            notification.fancy_title = `pluginNotificationTransformer ${index} ${notification.fancy_title}`;
          }
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user");

    const notifications = queryAll(
      "#quick-access-all-notifications ul li.notification"
    );
    assert.strictEqual(
      notifications[0].textContent.replace(/\s+/g, " ").trim(),
      "velesin pluginNotificationTransformer 0 edited topic 443"
    );
    assert.strictEqual(
      notifications[1].textContent.replace(/\s+/g, " ").trim(),
      "velesin pluginNotificationTransformer 1 some title"
    );
  });

  test("bookmarks tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("bookmark", (bookmarks) => {
        bookmarks.forEach((bookmark) => {
          if (bookmark.title) {
            bookmark.title = `pluginBookmarkTransformer ${bookmark.title}`;
          }
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-bookmarks");

    const bookmarks = queryAll("#quick-access-bookmarks ul li.bookmark");
    assert.strictEqual(
      bookmarks[0].textContent.replace(/\s+/g, " ").trim(),
      "osama pluginBookmarkTransformer Test poll topic hello world"
    );
  });

  test("messages tab applies model transformations registered by plugins", async function (assert) {
    withPluginApi("0.1", (api) => {
      api.registerModelTransformer("topic", (topics) => {
        topics.forEach((topic) => {
          topic.fancy_title = `pluginTransformer#1 ${topic.fancy_title}`;
        });
      });
      api.registerModelTransformer("topic", async (topics) => {
        // sleep 1 ms
        await new Promise((resolve) => later(resolve, 1));
        topics.forEach((topic) => {
          topic.fancy_title = `pluginTransformer#2 ${topic.fancy_title}`;
        });
      });
    });

    await visit("/");
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-messages");

    const messages = queryAll("#quick-access-messages ul li.message");
    assert.strictEqual(
      messages[0].textContent.replace(/\s+/g, " ").trim(),
      "mixtape pluginTransformer#2 pluginTransformer#1 BUG: Can not render emoji properly"
    );
  });

  test("the profile tab", async function (assert) {
    updateCurrentUser({ draft_count: 13 });
    await visit("/");
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    const summaryLink = query("#quick-access-profile ul li.summary a");
    assert.ok(
      summaryLink.href.endsWith("/u/eviltrout/summary"),
      "has a link to the summary page of the user"
    );
    assert.strictEqual(
      summaryLink.textContent.trim(),
      I18n.t("user.summary.title"),
      "summary link has the right label"
    );
    assert.ok(
      summaryLink.querySelector(".d-icon-user"),
      "summary link has the right icon"
    );

    const activityLink = query("#quick-access-profile ul li.activity a");
    assert.ok(
      activityLink.href.endsWith("/u/eviltrout/activity"),
      "has a link to the activity page of the user"
    );
    assert.strictEqual(
      activityLink.textContent.trim(),
      I18n.t("user.activity_stream"),
      "activity link has the right label"
    );
    assert.ok(
      activityLink.querySelector(".d-icon-stream"),
      "activity link has the right icon"
    );

    const invitesLink = query("#quick-access-profile ul li.invites a");
    assert.ok(
      invitesLink.href.endsWith("/u/eviltrout/invited"),
      "has a link to the invites page of the user"
    );
    assert.strictEqual(
      invitesLink.textContent.trim(),
      I18n.t("user.invited.title"),
      "invites link has the right label"
    );
    assert.ok(
      invitesLink.querySelector(".d-icon-user-plus"),
      "invites link has the right icon"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ can_invite_to_forum: false });
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.invites"),
      "invites link not shown when the user can't invite"
    );

    const dratsLink = query("#quick-access-profile ul li.drafts a");
    assert.ok(
      dratsLink.href.endsWith("/u/eviltrout/activity/drafts"),
      "has a link to the drafts page of the user"
    );
    assert.strictEqual(
      dratsLink.textContent.trim(),
      I18n.t("drafts.label_with_count", { count: 13 }),
      "drafts link has the right label with count of the user's drafts"
    );
    assert.ok(
      dratsLink.querySelector(".d-icon-pencil-alt"),
      "drafts link has the right icon"
    );

    const preferencesLink = query("#quick-access-profile ul li.preferences a");
    assert.ok(
      preferencesLink.href.endsWith("/u/eviltrout/preferences"),
      "has a link to the preferences page of the user"
    );
    assert.strictEqual(
      preferencesLink.textContent.trim(),
      I18n.t("user.preferences"),
      "preferences link has the right label"
    );
    assert.ok(
      preferencesLink.querySelector(".d-icon-cog"),
      "preferences link has the right icon"
    );

    let doNotDisturbButton = query(
      "#quick-access-profile ul li.do-not-disturb .btn"
    );
    assert.strictEqual(
      doNotDisturbButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("do_not_disturb.label"),
      "Do Not Disturb button has the right label"
    );
    assert.ok(
      doNotDisturbButton.querySelector(".d-icon-toggle-off"),
      "Do Not Disturb button has the right icon"
    );

    await click("header.d-header"); // close the menu
    const date = new Date();
    date.setHours(date.getHours() + 2);
    updateCurrentUser({ do_not_disturb_until: date.toISOString() });
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    doNotDisturbButton = query(
      "#quick-access-profile ul li.do-not-disturb .btn"
    );
    assert.strictEqual(
      doNotDisturbButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      `${I18n.t("do_not_disturb.label")} 2h`,
      "Do Not Disturb button has the right label when Do Not Disturb is enabled"
    );
    assert.ok(
      doNotDisturbButton.querySelector(".d-icon-toggle-on"),
      "Do Not Disturb button has the right icon when Do Not Disturb is enabled"
    );

    let toggleAnonButton = query(
      "#quick-access-profile ul li.enable-anonymous .btn"
    );
    assert.strictEqual(
      toggleAnonButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("switch_to_anon"),
      "toggle anonymous button has the right label when the user isn't anonymous"
    );
    assert.ok(
      toggleAnonButton.querySelector(".d-icon-user-secret"),
      "toggle anonymous button has the right icon when the user isn't anonymous"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ is_anonymous: true });
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    toggleAnonButton = query(
      "#quick-access-profile ul li.disable-anonymous .btn"
    );
    assert.strictEqual(
      toggleAnonButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("switch_from_anon"),
      "toggle anonymous button has the right label when the user is anonymous"
    );
    assert.ok(
      toggleAnonButton.querySelector(".d-icon-ban"),
      "toggle anonymous button has the right icon when the user is anonymous"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ is_anonymous: false, trust_level: 2 });
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button isn't shown when the user can't use it"
    );
    assert.notOk(
      exists("#quick-access-profile ul li.disable-anonymous"),
      "toggle anon button isn't shown when the user can't use it"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ is_anonymous: true, trust_level: 2 });
    this.siteSettings.allow_anonymous_posting = false;
    this.siteSettings.anonymous_posting_min_trust_level = 3;
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    assert.ok(
      exists("#quick-access-profile ul li.disable-anonymous"),
      "toggle anon button is always shown if the user is anonymous"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ is_anonymous: false, trust_level: 4 });
    this.siteSettings.allow_anonymous_posting = false;
    this.siteSettings.anonymous_posting_min_trust_level = 3;
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button is not shown if the allow_anonymous_posting setting is false"
    );

    await click("header.d-header"); // close the menu
    updateCurrentUser({ is_anonymous: false, trust_level: 2 });
    this.siteSettings.allow_anonymous_posting = true;
    this.siteSettings.anonymous_posting_min_trust_level = 3;
    await click(".d-header-icons .current-user");
    await click("#user-menu-button-profile");

    assert.notOk(
      exists("#quick-access-profile ul li.enable-anonymous"),
      "toggle anon button is not shown if the user doesn't have a high enough trust level"
    );

    const logoutButton = query("#quick-access-profile ul li.logout .btn");
    assert.strictEqual(
      logoutButton.textContent
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\u200B/g, "")
        .trim(),
      I18n.t("user.log_out"),
      "logout button has the right label"
    );
    assert.ok(
      logoutButton.querySelector(".d-icon-sign-out-alt"),
      "logout button has the right icon"
    );
  });
});

acceptance("User menu - Dismiss button", function (needs) {
  needs.user({
    redesigned_user_menu_enabled: true,
    unread_high_priority_notifications: 10,
    grouped_unread_notifications: {
      [NOTIFICATION_TYPES.bookmark_reminder]: 103,
      [NOTIFICATION_TYPES.private_message]: 89,
      [NOTIFICATION_TYPES.votes_released]: 1,
      [NOTIFICATION_TYPES.code_review_commit_approved]: 3,
    },
  });

  let markRead = false;
  let markReadRequestBody;

  needs.pretender((server, helper) => {
    server.put("/notifications/mark-read", (request) => {
      markReadRequestBody = request.requestBody;
      markRead = true;
      return helper.response({ success: true });
    });

    server.get("/u/eviltrout/user-menu-bookmarks", () => {
      if (markRead) {
        const copy = cloneJSON(
          UserMenuFixtures["/u/:username/user-menu-bookmarks"]
        );
        copy.notifications = [];
        return helper.response(copy);
      } else {
        return helper.response(
          UserMenuFixtures["/u/:username/user-menu-bookmarks"]
        );
      }
    });

    server.get("/u/eviltrout/user-menu-private-messages", () => {
      if (markRead) {
        const copy = cloneJSON(
          UserMenuFixtures["/u/:username/user-menu-private-messages"]
        );
        copy.notifications = [];
        return helper.response(copy);
      } else {
        return helper.response(
          UserMenuFixtures["/u/:username/user-menu-private-messages"]
        );
      }
    });
  });

  needs.hooks.afterEach(() => {
    markRead = false;
    markReadRequestBody = null;
  });

  test("shows confirmation modal for the all-notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    await click(".user-menu .notifications-dismiss");
    assert.strictEqual(
      query(".dismiss-notification-confirmation").textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.default", { count: 10 }),
      "confirmation modal is shown when there are unread high pri notifications"
    );

    await click(".modal-footer .btn-default"); // click cancel on the dismiss modal
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".user-menu .notifications-dismiss");
    await click(".modal-footer .btn-primary"); // click confirm on the dismiss modal
    assert.ok(markRead, "mark-read request is sent");
  });

  test("shows confirmation modal for the bookmarks list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    assert.strictEqual(
      query("#user-menu-button-bookmarks .badge-notification").textContent,
      "103",
      "bookmarks tab has bubble with count"
    );

    await click("#user-menu-button-bookmarks");
    assert.ok(
      exists("#quick-access-bookmarks ul li.notification"),
      "bookmark reminder notifications are visible"
    );
    assert.ok(
      exists("#quick-access-bookmarks ul li.bookmark"),
      "bookmarks are visible"
    );

    await click(".user-menu .notifications-dismiss");

    assert.strictEqual(
      query(".dismiss-notification-confirmation").textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.bookmarks", {
        count: 103,
      }),
      "confirmation modal is shown when there are unread bookmark reminder notifications"
    );
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".modal-footer .btn-primary"); // confirm dismiss on the dismiss modal

    assert.notOk(
      exists("#quick-access-bookmarks ul li.notification"),
      "bookmark reminder notifications are gone"
    );
    assert.ok(
      exists("#quick-access-bookmarks ul li.bookmark"),
      "bookmarks are still visible"
    );
    assert.notOk(
      exists("#user-menu-button-bookmarks .badge-notification"),
      "bookmarks tab no longer has bubble"
    );
    assert.ok(markRead, "mark-read request is sent");
    assert.strictEqual(
      markReadRequestBody,
      "dismiss_types=bookmark_reminder",
      "mark-read request specifies bookmark_reminder types"
    );
    assert.notOk(exists(".user-menu .notifications-dismiss"));
  });

  test("shows confirmation modal for the messages list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    assert.strictEqual(
      query("#user-menu-button-messages .badge-notification").textContent,
      "89",
      "messages tab has bubble with count"
    );

    await click("#user-menu-button-messages");
    assert.ok(
      exists("#quick-access-messages ul li.notification"),
      "messages notifications are visible"
    );
    assert.ok(
      exists("#quick-access-messages ul li.message"),
      "messages are visible"
    );

    await click(".user-menu .notifications-dismiss");

    assert.strictEqual(
      query(".dismiss-notification-confirmation").textContent.trim(),
      I18n.t("notifications.dismiss_confirmation.body.messages", {
        count: 89,
      }),
      "confirmation modal is shown when there are unread messages notifications"
    );
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".modal-footer .btn-primary"); // confirm dismiss on the dismiss modal

    assert.notOk(
      exists("#quick-access-messages ul li.notification"),
      "messages notifications are gone"
    );
    assert.ok(
      exists("#quick-access-messages ul li.message"),
      "messages are still visible"
    );
    assert.notOk(
      exists("#user-menu-button-messages .badge-notification"),
      "messages tab no longer has bubble"
    );
    assert.ok(markRead, "mark-read request is sent");
    assert.strictEqual(
      markReadRequestBody,
      "dismiss_types=private_message",
      "mark-read request specifies private_message types"
    );
    assert.notOk(exists(".user-menu .notifications-dismiss"));
  });

  test("doesn't show confirmation modal for the likes notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    await click("#user-menu-button-likes");
    await click(".user-menu .notifications-dismiss");
    assert.ok(
      markRead,
      "mark-read request is sent without a confirmation modal"
    );
  });

  test("doesn't show confirmation modal for the other notifications list", async function (assert) {
    await visit("/");
    await click(".d-header-icons .current-user");

    await click("#user-menu-button-other");
    let repliesBadgeNotification = query(
      "#user-menu-button-other .badge-notification"
    );
    assert.strictEqual(
      repliesBadgeNotification.textContent.trim(),
      "4",
      "badge shows the right count"
    );

    await click(".user-menu .notifications-dismiss");

    assert.ok(!exists("#user-menu-button-other .badge-notification"));
    assert.ok(
      markRead,
      "mark-read request is sent without a confirmation modal"
    );
  });
});
