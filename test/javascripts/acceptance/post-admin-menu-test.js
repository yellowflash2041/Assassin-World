import { acceptance } from "helpers/qunit-helpers";

acceptance("Post - Admin Menu Anonymous Users", { loggedIn: false });

QUnit.test("Enter as a anon user", async assert => {
  await visit("/t/internationalization-localization/280");
  await click(".show-more-actions");

  assert.ok(exists("#topic"), "The topic was rendered");
  assert.ok(exists("#post_1 .post-controls .edit"), "The edit button was not rendered");
  assert.ok(!exists(".show-post-admin-menu"), "The wrench button was not rendered");
});

acceptance("Post - Admin Menu", { loggedIn: true });

QUnit.test("Enter as a user with group moderator permissions", async assert => {
  await visit("/t/topic-for-group-moderators/2480");
  await click(".show-more-actions");
  await click(".show-post-admin-menu");

  assert.ok(exists("#post_1 .post-controls .edit"), "The edit button was rendered");
  assert.ok(exists(".add-notice"), "The add notice button was rendered");
});
