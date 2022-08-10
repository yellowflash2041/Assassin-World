import { click, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  loggedInUser,
  publishToMessageBus,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { cloneJSON } from "discourse-common/lib/object";
import { withPluginApi } from "discourse/lib/plugin-api";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import UserMenuFixtures from "discourse/tests/fixtures/user-menu";
import TopicFixtures from "discourse/tests/fixtures/topic";
import I18n from "I18n";

acceptance("User menu", function (needs) {
  needs.user({
    redesigned_user_menu_enabled: true,
    unread_high_priority_notifications: 73,
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
    await click(".user-menu ul li.replied a");

    assert.strictEqual(
      requestHeaders["Discourse-Clear-Notifications"],
      123, // id is from the fixtures in fixtures/notification-fixtures.js
      "the Discourse-Clear-Notifications request header is set to the notification id in the next ajax request"
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

    await visit("/");
    await click(".d-header-icons .current-user");

    const customTab1 = query("#user-menu-button-custom-tab-1");
    const customTab2 = query("#user-menu-button-custom-tab-2");

    assert.ok(customTab1, "first custom tab is rendered");
    assert.ok(customTab2, "second custom tab is rendered");

    assert.strictEqual(
      customTab1.dataset.tabNumber,
      "5",
      "custom tab has the right tab number"
    );

    assert.strictEqual(
      customTab2.dataset.tabNumber,
      "6",
      "custom tab has the right tab number"
    );

    const reviewQueueTab = query("#user-menu-button-review-queue");

    assert.strictEqual(
      reviewQueueTab.dataset.tabNumber,
      "7",
      "review queue tab comes after the custom tabs"
    );

    const tabs = [...queryAll(".tabs-list .btn")]; // top and bottom tabs

    assert.deepEqual(
      tabs.map((t) => t.dataset.tabNumber),
      ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
      "data-tab-number of the tabs has no gaps when custom tabs are added"
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
});

acceptance("User menu - Dismiss button", function (needs) {
  needs.user({
    redesigned_user_menu_enabled: true,
    unread_high_priority_notifications: 10,
    grouped_unread_high_priority_notifications: {
      [NOTIFICATION_TYPES.bookmark_reminder]: 103,
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
    assert.notOk(markRead, "mark-read request isn't sent");

    await click(".modal-footer .btn-default"); // click cancel on the dismiss modal

    await publishToMessageBus(`/notification/${loggedInUser().id}`, {
      unread_high_priority_notifications: 0,
    });
    await click(".user-menu .notifications-dismiss");
    assert.ok(
      markRead,
      "mark-read request is sent without a confirmation modal when there are no unread high pri notifications"
    );
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
    await publishToMessageBus(`/notification/${loggedInUser().id}`, {
      grouped_unread_high_priority_notifications: {},
    });

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
});
