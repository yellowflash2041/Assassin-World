import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import I18n from "I18n";
import userFixtures from "discourse/tests/fixtures/user-fixtures";
import { cloneJSON } from "discourse-common/lib/object";

acceptance("User Profile - Summary", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.get("/u/eviltrout.json", () => {
      const response = cloneJSON(userFixtures["/u/eviltrout.json"]);
      return helper.response(response);
    });
  });

  test("Viewing Summary", async function (assert) {
    await visit("/u/eviltrout/summary");

    assert.ok(exists(".replies-section li a"), "replies");
    assert.ok(exists(".topics-section li a"), "topics");
    assert.ok(exists(".links-section li a"), "links");
    assert.ok(exists(".replied-section .user-info"), "liked by");
    assert.ok(exists(".liked-by-section .user-info"), "liked by");
    assert.ok(exists(".liked-section .user-info"), "liked");
    assert.ok(exists(".badges-section .badge-card"), "badges");
    assert.ok(
      exists(".top-categories-section .category-link"),
      "top categories"
    );
  });
});

acceptance("User Profile - Summary - User Status", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.get("/u/eviltrout.json", () => {
      const response = cloneJSON(userFixtures["/u/eviltrout.json"]);
      response.user.status = {
        description: "off to dentist",
        emoji: "tooth",
      };
      return helper.response(response);
    });
  });

  test("Shows User Status", async function (assert) {
    await visit("/u/eviltrout/summary");
    assert.ok(exists(".user-status-message .emoji[alt='tooth']"));
  });
});

acceptance("User Profile - Summary - Stats", function (needs) {
  needs.pretender((server, helper) => {
    server.get("/u/eviltrout/summary.json", () => {
      return helper.response(200, {
        user_summary: {
          likes_given: 1,
          likes_received: 2,
          topics_entered: 3,
          posts_read_count: 4,
          days_visited: 5,
          topic_count: 6,
          post_count: 7,
          time_read: 100000,
          recent_time_read: 1000,
          bookmark_count: 0,
          can_see_summary_stats: true,
          topic_ids: [1234],
          replies: [{ topic_id: 1234 }],
          links: [{ topic_id: 1234, url: "https://eviltrout.com" }],
          most_replied_to_users: [{ id: 333 }],
          most_liked_by_users: [{ id: 333 }],
          most_liked_users: [{ id: 333 }],
          badges: [{ badge_id: 444 }],
          top_categories: [
            {
              id: 1,
              name: "bug",
              color: "e9dd00",
              text_color: "000000",
              slug: "bug",
              read_restricted: false,
              parent_category_id: null,
              topic_count: 1,
              post_count: 1,
            },
          ],
        },
        badges: [{ id: 444, count: 1 }],
        topics: [{ id: 1234, title: "cool title", slug: "cool-title" }],
      });
    });
  });

  test("Summary Read Times", async function (assert) {
    await visit("/u/eviltrout/summary");

    assert.equal(query(".stats-time-read span").textContent.trim(), "1d");
    assert.equal(
      query(".stats-time-read span").title,
      I18n.t("user.summary.time_read_title", { duration: "1 day" })
    );

    assert.equal(query(".stats-recent-read span").textContent.trim(), "17m");
    assert.equal(
      query(".stats-recent-read span").title,
      I18n.t("user.summary.recent_time_read_title", { duration: "17 mins" })
    );
  });
});
