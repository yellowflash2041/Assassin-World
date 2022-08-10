import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { exists, query, queryAll } from "discourse/tests/helpers/qunit-helpers";
import { click, render, settled } from "@ember/test-helpers";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import { hbs } from "ember-cli-htmlbars";
import pretender from "discourse/tests/helpers/create-pretender";

module("Integration | Component | user-menu", function (hooks) {
  setupRenderingTest(hooks);

  const template = hbs`<UserMenu::Menu/>`;

  test("default tab is all notifications", async function (assert) {
    await render(template);
    const activeTab = query(".top-tabs.tabs-list .btn.active");
    assert.strictEqual(activeTab.id, "user-menu-button-all-notifications");
    const notifications = queryAll("#quick-access-all-notifications ul li");
    assert.ok(notifications[0].classList.contains("edited"));
    assert.ok(notifications[1].classList.contains("replied"));
    assert.ok(notifications[2].classList.contains("liked-consolidated"));
  });

  test("notifications panel has a11y attributes", async function (assert) {
    await render(template);
    const panel = query("#quick-access-all-notifications");
    assert.strictEqual(panel.getAttribute("tabindex"), "-1");
    assert.strictEqual(
      panel.getAttribute("aria-labelledby"),
      "user-menu-button-all-notifications"
    );
  });

  test("active tab has a11y attributes that indicate it's active", async function (assert) {
    await render(template);
    const activeTab = query(".top-tabs.tabs-list .btn.active");
    assert.strictEqual(activeTab.getAttribute("tabindex"), "0");
    assert.strictEqual(activeTab.getAttribute("aria-selected"), "true");
  });

  test("inactive tab has a11y attributes that indicate it's inactive", async function (assert) {
    await render(template);
    const inactiveTab = query(".top-tabs.tabs-list .btn:not(.active)");
    assert.strictEqual(inactiveTab.getAttribute("tabindex"), "-1");
    assert.strictEqual(inactiveTab.getAttribute("aria-selected"), "false");
  });

  test("the menu has a group of tabs at the top", async function (assert) {
    await render(template);
    const tabs = queryAll(".top-tabs.tabs-list .btn");
    assert.strictEqual(tabs.length, 6);
    [
      "all-notifications",
      "replies",
      "mentions",
      "likes",
      "messages",
      "bookmarks",
    ].forEach((tab, index) => {
      assert.strictEqual(tabs[index].id, `user-menu-button-${tab}`);
      assert.strictEqual(tabs[index].dataset.tabNumber, index.toString());
      assert.strictEqual(
        tabs[index].getAttribute("aria-controls"),
        `quick-access-${tab}`
      );
    });
  });

  test("the menu has a group of tabs at the bottom", async function (assert) {
    await render(template);
    const tabs = queryAll(".bottom-tabs.tabs-list .btn");
    assert.strictEqual(tabs.length, 1);
    const preferencesTab = tabs[0];
    assert.ok(preferencesTab.href.endsWith("/u/eviltrout/preferences"));
    assert.strictEqual(preferencesTab.dataset.tabNumber, "6");
    assert.strictEqual(preferencesTab.getAttribute("tabindex"), "-1");
  });

  test("likes tab is hidden if current user's like notifications frequency is 'never'", async function (assert) {
    this.currentUser.set("likes_notifications_disabled", true);
    await render(template);
    assert.ok(!exists("#user-menu-button-likes"));

    const tabs = Array.from(queryAll(".tabs-list .btn")); // top and bottom tabs
    assert.strictEqual(tabs.length, 6);

    assert.deepEqual(
      tabs.map((t) => t.dataset.tabNumber),
      ["0", "1", "2", "3", "4", "5"],
      "data-tab-number of the tabs has no gaps when the likes tab is hidden"
    );
  });

  test("reviewables tab is shown if current user can review", async function (assert) {
    this.currentUser.set("can_review", true);
    await render(template);
    const tab = query("#user-menu-button-review-queue");
    assert.strictEqual(tab.dataset.tabNumber, "6");

    const tabs = Array.from(queryAll(".tabs-list .btn")); // top and bottom tabs
    assert.strictEqual(tabs.length, 8);

    assert.deepEqual(
      tabs.map((t) => t.dataset.tabNumber),
      ["0", "1", "2", "3", "4", "5", "6", "7"],
      "data-tab-number of the tabs has no gaps when the reviewables tab is show"
    );
  });

  test("messages tab isn't shown if current user isn't staff and enable_personal_messages setting is disabled", async function (assert) {
    this.currentUser.set("moderator", false);
    this.currentUser.set("admin", false);
    this.siteSettings.enable_personal_messages = false;

    await render(template);

    assert.ok(!exists("#user-menu-button-messages"));

    const tabs = Array.from(queryAll(".tabs-list .btn")); // top and bottom tabs
    assert.strictEqual(tabs.length, 6);

    assert.deepEqual(
      tabs.map((t) => t.dataset.tabNumber),
      ["0", "1", "2", "3", "4", "5"],
      "data-tab-number of the tabs has no gaps when the messages tab is hidden"
    );
  });

  test("messages tab is shown if current user is staff even if enable_personal_messages setting is disabled", async function (assert) {
    this.currentUser.set("moderator", true);
    this.currentUser.set("admin", false);
    this.siteSettings.enable_personal_messages = false;

    await render(template);

    assert.ok(exists("#user-menu-button-messages"));
  });

  test("reviewables count is shown on the reviewables tab", async function (assert) {
    this.currentUser.set("can_review", true);
    this.currentUser.set("reviewable_count", 4);
    await render(template);
    const countBadge = query(
      "#user-menu-button-review-queue .badge-notification"
    );
    assert.strictEqual(countBadge.textContent, "4");

    this.currentUser.set("reviewable_count", 0);
    await settled();

    assert.ok(!exists("#user-menu-button-review-queue .badge-notification"));
  });

  test("changing tabs", async function (assert) {
    this.currentUser.set("can_review", true);
    await render(template);
    let queryParams;
    pretender.get("/notifications", (request) => {
      queryParams = request.queryParams;
      let data;
      if (queryParams.filter_by_types === "mentioned") {
        data = [
          {
            id: 6,
            user_id: 1,
            notification_type: NOTIFICATION_TYPES.mentioned,
            read: true,
            high_priority: false,
            created_at: "2021-11-25T19:31:13.241Z",
            post_number: 6,
            topic_id: 10,
            fancy_title: "Greetings!",
            slug: "greetings",
            data: {
              topic_title: "Greetings!",
              original_post_id: 20,
              original_post_type: 1,
              original_username: "discobot",
              revision_number: null,
              display_username: "discobot",
            },
          },
        ];
      } else if (queryParams.filter_by_types === "liked,liked_consolidated") {
        data = [
          {
            id: 60,
            user_id: 1,
            notification_type: NOTIFICATION_TYPES.liked,
            read: true,
            high_priority: false,
            created_at: "2021-11-25T19:31:13.241Z",
            post_number: 6,
            topic_id: 10,
            fancy_title: "Greetings!",
            slug: "greetings",
            data: {
              topic_title: "Greetings!",
              original_post_id: 20,
              original_post_type: 1,
              original_username: "discobot",
              revision_number: null,
              display_username: "discobot",
            },
          },
          {
            id: 63,
            user_id: 1,
            notification_type: NOTIFICATION_TYPES.liked,
            read: true,
            high_priority: false,
            created_at: "2021-11-25T19:31:13.241Z",
            post_number: 6,
            topic_id: 10,
            fancy_title: "Greetings!",
            slug: "greetings",
            data: {
              topic_title: "Greetings!",
              original_post_id: 20,
              original_post_type: 1,
              original_username: "discobot",
              revision_number: null,
              display_username: "discobot",
            },
          },
          {
            id: 20,
            user_id: 1,
            notification_type: NOTIFICATION_TYPES.liked_consolidated,
            read: true,
            high_priority: false,
            created_at: "2021-11-25T19:31:13.241Z",
            post_number: 6,
            topic_id: 10,
            fancy_title: "Greetings 123!",
            slug: "greetings 123",
            data: {
              topic_title: "Greetings 123!",
              original_post_id: 20,
              original_post_type: 1,
              original_username: "discobot",
              revision_number: null,
              display_username: "discobot",
            },
          },
        ];
      } else {
        throw new Error(
          `unexpected notification type ${queryParams.filter_by_types}`
        );
      }

      return [
        200,
        { "Content-Type": "application/json" },
        { notifications: data },
      ];
    });

    await click("#user-menu-button-mentions");
    assert.ok(exists("#quick-access-mentions.quick-access-panel"));
    assert.strictEqual(
      queryParams.filter_by_types,
      "mentioned",
      "request params has filter_by_types set to `mentioned`"
    );
    assert.strictEqual(queryParams.silent, "true");
    let activeTabs = queryAll(".top-tabs .btn.active");
    assert.strictEqual(activeTabs.length, 1);
    assert.strictEqual(
      activeTabs[0].id,
      "user-menu-button-mentions",
      "active tab is now the mentions tab"
    );
    assert.strictEqual(queryAll("#quick-access-mentions ul li").length, 1);

    await click("#user-menu-button-likes");
    assert.ok(exists("#quick-access-likes.quick-access-panel"));
    assert.strictEqual(
      queryParams.filter_by_types,
      "liked,liked_consolidated",
      "request params has filter_by_types set to `liked` and `liked_consolidated"
    );
    assert.strictEqual(queryParams.silent, "true");
    activeTabs = queryAll(".top-tabs .btn.active");
    assert.strictEqual(activeTabs.length, 1);
    assert.strictEqual(
      activeTabs[0].id,
      "user-menu-button-likes",
      "active tab is now the likes tab"
    );
    assert.strictEqual(queryAll("#quick-access-likes ul li").length, 3);

    await click("#user-menu-button-review-queue");
    assert.ok(exists("#quick-access-review-queue.quick-access-panel"));
    activeTabs = queryAll(".top-tabs .btn.active");
    assert.strictEqual(activeTabs.length, 1);
    assert.strictEqual(
      activeTabs[0].id,
      "user-menu-button-review-queue",
      "active tab is now the reviewables tab"
    );
    assert.strictEqual(queryAll("#quick-access-review-queue ul li").length, 8);
  });
});
