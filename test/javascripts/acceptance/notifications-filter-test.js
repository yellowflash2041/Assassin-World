import { acceptance } from "helpers/qunit-helpers";
import selectKit from "helpers/select-kit-helper";

acceptance("NotificationsFilter", {
  loggedIn: true,
});

test("Notifications filter true", async (assert) => {
  await visit("/u/eviltrout/notifications");

  assert.ok(find(".large-notification").length >= 0);
});

test("Notifications filter read", async (assert) => {
  await visit("/u/eviltrout/notifications");

  const dropdown = selectKit(".notifications-filter");
  await dropdown.expand();
  await dropdown.selectRowByValue("read");

  assert.ok(find(".large-notification").length >= 0);
});

test("Notifications filter unread", async (assert) => {
  await visit("/u/eviltrout/notifications");

  const dropdown = selectKit(".notifications-filter");
  await dropdown.expand();
  await dropdown.selectRowByValue("unread");

  assert.ok(find(".large-notification").length >= 0);
});
