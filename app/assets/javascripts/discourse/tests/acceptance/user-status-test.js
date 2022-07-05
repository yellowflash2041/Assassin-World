import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";

async function openUserStatusModal() {
  await click(".header-dropdown-toggle.current-user");
  await click(".menu-links-row .user-preferences-link");
  await click(".user-status button");
}

async function pickEmoji(emoji) {
  await click(".btn-emoji");
  await fillIn(".emoji-picker-content .filter", emoji);
  await click(".results .emoji");
}

acceptance("User Status", function (needs) {
  const userStatus = "off to dentist";
  const userStatusEmoji = "tooth";
  const userId = 1;
  const userTimezone = "UTC";

  needs.user({ id: userId, timezone: userTimezone });

  needs.pretender((server, helper) => {
    server.put("/user-status.json", () => {
      publishToMessageBus(`/user-status/${userId}`, {
        description: userStatus,
        emoji: userStatusEmoji,
      });
      return helper.response({ success: true });
    });
    server.delete("/user-status.json", () => {
      publishToMessageBus(`/user-status/${userId}`, null);
      return helper.response({ success: true });
    });
  });

  test("doesn't show the user status button on the menu by default", async function (assert) {
    this.siteSettings.enable_user_status = false;

    await visit("/");
    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");

    assert.notOk(exists("div.quick-access-panel li.user-status"));
  });

  test("shows the user status button on the menu when enabled in settings", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit("/");
    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");

    assert.ok(
      exists("div.quick-access-panel li.user-status"),
      "shows the button"
    );
    assert.ok(
      exists("div.quick-access-panel li.user-status svg.d-icon-plus-circle"),
      "shows the icon on the button"
    );
  });

  test("shows user status on loaded page", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({
      status: { description: userStatus, emoji: userStatusEmoji },
    });

    await visit("/");
    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");

    assert.equal(
      query("div.quick-access-panel li.user-status span.d-button-label")
        .innerText,
      userStatus,
      "shows user status description on the menu"
    );

    assert.equal(
      query("div.quick-access-panel li.user-status img.emoji").alt,
      `:${userStatusEmoji}:`,
      "shows user status emoji on the menu"
    );

    assert.equal(
      query(".header-dropdown-toggle .user-status-background img.emoji").alt,
      `:${userStatusEmoji}:`,
      "shows user status emoji on the user avatar in the header"
    );
  });

  test("shows user status on the user status modal", async function (assert) {
    this.siteSettings.enable_user_status = true;

    updateCurrentUser({
      status: {
        description: userStatus,
        emoji: userStatusEmoji,
        ends_at: "2100-02-01T09:35:00.000Z",
      },
    });

    await visit("/");
    await openUserStatusModal();

    assert.equal(
      query(`.btn-emoji img.emoji`).title,
      userStatusEmoji,
      "status emoji is shown"
    );
    assert.equal(
      query(".user-status-description").value,
      userStatus,
      "status description is shown"
    );
    assert.equal(
      query(".date-picker").value,
      "2100-02-01",
      "date of auto removing of status is shown"
    );
    assert.equal(
      query(".time-input").value,
      "09:35",
      "time of auto removing of status is shown"
    );
  });

  test("emoji picking", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit("/");
    await openUserStatusModal();

    assert.ok(exists(`.d-icon-discourse-emojis`), "empty status icon is shown");

    await click(".btn-emoji");
    assert.ok(exists(".emoji-picker.opened"), "emoji picker is opened");

    await fillIn(".emoji-picker-content .filter", userStatusEmoji);
    await click(".results .emoji");
    assert.ok(
      exists(`.btn-emoji img.emoji[title=${userStatusEmoji}]`),
      "chosen status emoji is shown"
    );
  });

  test("setting user status", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit("/");
    await openUserStatusModal();

    await fillIn(".user-status-description", userStatus);
    await pickEmoji(userStatusEmoji);
    assert.ok(
      exists(`.btn-emoji img.emoji[title=${userStatusEmoji}]`),
      "chosen status emoji is shown"
    );
    await click(".btn-primary"); // save

    assert.equal(
      query(".header-dropdown-toggle .user-status-background img.emoji").alt,
      `:${userStatusEmoji}:`,
      "shows user status emoji on the user avatar in the header"
    );

    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");
    assert.equal(
      query("div.quick-access-panel li.user-status span.d-button-label")
        .innerText,
      userStatus,
      "shows user status description on the menu"
    );

    assert.equal(
      query("div.quick-access-panel li.user-status img.emoji").alt,
      `:${userStatusEmoji}:`,
      "shows user status emoji on the menu"
    );
  });

  test("updating user status", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({ status: { description: userStatus } });
    const updatedStatus = "off to dentist the second time";

    await visit("/");
    await openUserStatusModal();

    await fillIn(".user-status-description", updatedStatus);
    await pickEmoji(userStatusEmoji);
    await click(".btn-primary"); // save

    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");
    assert.equal(
      query("div.quick-access-panel li.user-status span.d-button-label")
        .innerText,
      updatedStatus,
      "shows user status description on the menu"
    );
    assert.equal(
      query("div.quick-access-panel li.user-status img.emoji").alt,
      `:${userStatusEmoji}:`,
      "shows user status emoji on the menu"
    );
  });

  test("clearing user status", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({ status: { description: userStatus } });

    await visit("/");
    await openUserStatusModal();
    await click(".btn.delete-status");

    assert.notOk(exists(".header-dropdown-toggle .user-status-background"));
  });

  test("setting user status with auto removing timer", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit("/");
    await openUserStatusModal();

    await fillIn(".user-status-description", userStatus);
    await pickEmoji(userStatusEmoji);
    await click("#tap_tile_one_hour");
    await click(".btn-primary"); // save

    await click(".header-dropdown-toggle.current-user");
    await click(".menu-links-row .user-preferences-link");

    assert.equal(
      query("div.quick-access-panel li.user-status span.relative-date")
        .innerText,
      "1h",
      "shows user status timer on the menu"
    );
  });

  test("it's impossible to set status without description", async function (assert) {
    this.siteSettings.enable_user_status = true;

    await visit("/");
    await openUserStatusModal();
    await pickEmoji(userStatusEmoji);

    assert.ok(exists(`.btn-primary[disabled]`), "the save button is disabled");
  });

  test("sets default status emoji automatically after user started inputting  status description", async function (assert) {
    this.siteSettings.enable_user_status = true;
    const defaultStatusEmoji = "speech_balloon";

    await visit("/");
    await openUserStatusModal();
    await fillIn(".user-status-description", "some status");

    assert.ok(
      exists(`.btn-emoji img.emoji[title=${defaultStatusEmoji}]`),
      "default status emoji is shown"
    );
  });

  test("shows actual status on the modal after canceling the modal and opening it again", async function (assert) {
    this.siteSettings.enable_user_status = true;

    updateCurrentUser({
      status: { description: userStatus, emoji: userStatusEmoji },
    });

    await visit("/");
    await openUserStatusModal();
    await fillIn(".user-status-description", "another status");
    await pickEmoji("cold_face"); // another emoji
    await click(".d-modal-cancel");
    await openUserStatusModal();

    assert.equal(
      query(`.btn-emoji img.emoji`).title,
      userStatusEmoji,
      "the actual status emoji is shown"
    );
    assert.equal(
      query(".user-status-description").value,
      userStatus,
      "the actual status description is shown"
    );
  });

  test("shows the trash button when editing status that was set before", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({ status: { description: userStatus } });

    await visit("/");
    await openUserStatusModal();

    assert.ok(exists(".btn.delete-status"));
  });

  test("doesn't show the trash button when status wasn't set before", async function (assert) {
    this.siteSettings.enable_user_status = true;
    updateCurrentUser({ status: null });

    await visit("/");
    await openUserStatusModal();

    assert.notOk(exists(".btn.delete-status"));
  });

  test("shows empty modal after deleting the status", async function (assert) {
    this.siteSettings.enable_user_status = true;

    updateCurrentUser({
      status: { description: userStatus, emoji: userStatusEmoji },
    });

    await visit("/");
    await openUserStatusModal();
    await click(".btn.delete-status");
    await openUserStatusModal();

    assert.ok(exists(`.d-icon-discourse-emojis`), "empty status icon is shown");
    assert.equal(
      query(".user-status-description").value,
      "",
      "no status description is shown"
    );
  });
});
