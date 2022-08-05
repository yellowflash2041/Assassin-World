import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { NOTIFICATION_TYPES } from "discourse/tests/fixtures/concerns/notification-types";
import { deepMerge } from "discourse-common/lib/object";
import { createRenderDirector } from "discourse/tests/helpers/notification-items-helper";
import Notification from "discourse/models/notification";

function getNotification(overrides = {}) {
  return Notification.create(
    deepMerge(
      {
        id: 11,
        user_id: 1,
        notification_type: NOTIFICATION_TYPES.group_mentioned,
        read: false,
        high_priority: false,
        created_at: "2022-07-01T06:00:32.173Z",
        post_number: 113,
        topic_id: 449,
        fancy_title: "This is fancy title &lt;a&gt;!",
        slug: "this-is-fancy-title",
        data: {
          topic_title: "this is title before it becomes fancy <a>!",
          original_post_id: 112,
          original_post_type: 1,
          original_username: "kolary",
          display_username: "osama",
          group_id: 333,
          group_name: "hikers",
        },
      },
      overrides
    )
  );
}

discourseModule("Unit | Notification Items | group-mentioned", function () {
  test("label", function (assert) {
    const notification = getNotification();
    const director = createRenderDirector(
      notification,
      "group_mentioned",
      this.siteSettings
    );
    assert.strictEqual(
      director.label,
      "osama @hikers",
      "contains the user who mentioned and the mentioned group"
    );
  });
});
