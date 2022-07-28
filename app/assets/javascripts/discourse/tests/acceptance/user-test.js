import EmberObject from "@ember/object";
import User from "discourse/models/user";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import sinon from "sinon";
import userFixtures from "discourse/tests/fixtures/user-fixtures";
import {
  acceptance,
  exists,
  query,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, currentRouteName, visit } from "@ember/test-helpers";
import { cloneJSON } from "discourse-common/lib/object";
import { test } from "qunit";

acceptance("User Routes", function (needs) {
  needs.user();

  needs.pretender((server, helper) => {
    server.get("/u/eviltrout%2F..%2F..%2F.json", () =>
      helper.response(400, {})
    );
  });
  test("Invalid usernames", async function (assert) {
    try {
      await visit("/u/eviltrout%2F..%2F..%2F/summary");
    } catch (e) {
      if (e.message !== "TransitionAborted") {
        throw e;
      }
    }

    assert.strictEqual(currentRouteName(), "exception-unknown");
  });

  test("Unicode usernames", async function (assert) {
    await visit("/u/%E3%83%A9%E3%82%A4%E3%82%AA%E3%83%B3/summary");

    assert.strictEqual(currentRouteName(), "user.summary");
  });

  test("Invites", async function (assert) {
    await visit("/u/eviltrout/invited/pending");
    assert.ok(
      document.body.classList.contains("user-invites-page"),
      "has the body class"
    );
  });

  test("Notifications", async function (assert) {
    await visit("/u/eviltrout/notifications");
    assert.ok(
      document.body.classList.contains("user-notifications-page"),
      "has the body class"
    );

    const $links = queryAll(".item.notification a");

    assert.ok(
      $links[2].href.includes(
        "/u/eviltrout/notifications/likes-received?acting_username=aquaman"
      )
    );

    updateCurrentUser({ moderator: true, admin: false });
    await visit("/u/charlie/summary");
    assert.notOk(
      exists(".user-nav > .user-notifications"),
      "does not have the notifications tab"
    );

    updateCurrentUser({ moderator: false, admin: true });
    await visit("/u/charlie/summary");
    assert.ok(
      exists(".user-nav > .user-notifications"),
      "has the notifications tab"
    );
  });

  test("Root URL - Viewing Self", async function (assert) {
    await visit("/u/eviltrout");
    assert.ok(
      document.body.classList.contains("user-activity-page"),
      "has the body class"
    );
    assert.strictEqual(
      currentRouteName(),
      "userActivity.index",
      "it defaults to activity"
    );
    assert.ok(exists(".container.viewing-self"), "has the viewing-self class");
  });

  test("Viewing Drafts", async function (assert) {
    await visit("/u/eviltrout/activity/drafts");
    assert.ok(exists(".user-stream"), "has drafts stream");
    assert.ok(
      exists(".user-stream .user-stream-item-draft-actions"),
      "has draft action buttons"
    );

    await click(".user-stream button.resume-draft:nth-of-type(1)");
    assert.ok(
      exists(".d-editor-input"),
      "composer is visible after resuming a draft"
    );
  });
});

acceptance(
  "User Routes - Periods in current user's username",
  function (needs) {
    needs.user({ username: "e.il.rout" });

    test("Periods in current user's username don't act like wildcards", async function (assert) {
      await visit("/u/eviltrout");
      assert.strictEqual(
        query(".user-profile-names .username").textContent.trim(),
        "eviltrout",
        "eviltrout profile is shown"
      );

      await visit("/u/e.il.rout");
      assert.strictEqual(
        query(".user-profile-names .username").textContent.trim(),
        "e.il.rout",
        "e.il.rout profile is shown"
      );
    });
  }
);

acceptance("User Routes - Moderator viewing warnings", function (needs) {
  needs.user({
    username: "notEviltrout",
    moderator: true,
    staff: true,
    admin: false,
  });

  test("Messages - Warnings", async function (assert) {
    await visit("/u/eviltrout/messages/warnings");
    assert.ok(
      document.body.classList.contains("user-messages-page"),
      "has the body class"
    );
    assert.ok(exists("div.alert-info"), "has the permissions alert");
  });
});

acceptance("User - Saving user options", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    user_option: EmberObject.create({}),
  });

  needs.settings({
    disable_mailing_list_mode: false,
  });

  needs.pretender((server, helper) => {
    server.put("/u/eviltrout.json", () => {
      return helper.response(200, { user: {} });
    });
  });

  test("saving user options", async function (assert) {
    const spy = sinon.spy(User.current(), "_saveUserData");

    await visit("/u/eviltrout/preferences/emails");
    await click(".pref-mailing-list-mode input[type='checkbox']");
    await click(".save-changes");

    assert.ok(
      spy.calledWithMatch({ mailing_list_mode: true }),
      "sends a PUT request to update the specified user option"
    );

    await selectKit("#user-email-messages-level").expand();
    await selectKit("#user-email-messages-level").selectRowByValue(2); // never option
    await click(".save-changes");

    assert.ok(
      spy.calledWithMatch({ email_messages_level: 2 }),
      "is able to save a different user_option on a subsequent request"
    );
  });
});

acceptance("User - Notification level dropdown visibility", function (needs) {
  needs.user({ username: "eviltrout", id: 1, ignored_ids: [] });

  needs.pretender((server, helper) => {
    server.get("/u/charlie.json", () => {
      const cloned = cloneJSON(userFixtures["/u/charlie.json"]);
      cloned.user.can_ignore_user = false;
      cloned.user.can_mute_user = false;
      return helper.response(200, cloned);
    });
  });

  test("Notification level button is not rendered for user who cannot mute or ignore another user", async function (assert) {
    await visit("/u/charlie");
    assert.notOk(exists(".user-notifications-dropdown"));
  });
});

acceptance(
  "User - Muting other user with notification level dropdown",
  function (needs) {
    needs.user({ username: "eviltrout", id: 1, ignored_ids: [] });

    needs.pretender((server, helper) => {
      server.get("/u/charlie.json", () => {
        const cloned = cloneJSON(userFixtures["/u/charlie.json"]);
        cloned.user.can_mute_user = true;
        return helper.response(200, cloned);
      });

      server.put("/u/charlie/notification_level.json", (request) => {
        let requestParams = new URLSearchParams(request.requestBody);
        // Ensure the correct `notification_level` param is sent to the server
        if (requestParams.get("notification_level") === "mute") {
          return helper.response(200, {});
        } else {
          return helper.response(422, {});
        }
      });
    });

    test("Notification level is set to normal and can be changed to muted", async function (assert) {
      await visit("/u/charlie");
      assert.ok(
        exists(".user-notifications-dropdown"),
        "Notification level dropdown is present"
      );

      const dropdown = selectKit(".user-notifications-dropdown");
      await dropdown.expand();
      assert.strictEqual(dropdown.selectedRow().value(), "changeToNormal");

      await dropdown.selectRowByValue("changeToMuted");
      await dropdown.expand();
      assert.strictEqual(dropdown.selectedRow().value(), "changeToMuted");
    });
  }
);

acceptance(
  "User - Ignoring other user with notification level dropdown",
  function (needs) {
    needs.user({ username: "eviltrout", id: 1, ignored_ids: [] });

    needs.pretender((server, helper) => {
      server.get("/u/charlie.json", () => {
        const cloned = cloneJSON(userFixtures["/u/charlie.json"]);
        cloned.user.can_ignore_user = true;
        return helper.response(200, cloned);
      });

      server.put("/u/charlie/notification_level.json", (request) => {
        let requestParams = new URLSearchParams(request.requestBody);
        // Ensure the correct `notification_level` param is sent to the server
        if (requestParams.get("notification_level") === "ignore") {
          return helper.response(200, {});
        } else {
          return helper.response(422, {});
        }
      });
    });
    test("Notification level can be changed to ignored", async function (assert) {
      await visit("/u/charlie");
      assert.ok(
        exists(".user-notifications-dropdown"),
        "Notification level dropdown is present"
      );

      const notificationLevelDropdown = selectKit(
        ".user-notifications-dropdown"
      );
      await notificationLevelDropdown.expand();
      assert.strictEqual(
        notificationLevelDropdown.selectedRow().value(),
        "changeToNormal"
      );

      await notificationLevelDropdown.selectRowByValue("changeToIgnored");
      assert.ok(exists(".ignore-duration-modal"));

      const durationDropdown = selectKit(
        ".ignore-duration-modal .future-date-input-selector"
      );
      await durationDropdown.expand();
      await durationDropdown.selectRowByIndex(0);
      await click(".modal-footer .ignore-duration-save");
      await notificationLevelDropdown.expand();
      assert.strictEqual(
        notificationLevelDropdown.selectedRow().value(),
        "changeToIgnored"
      );
    });
  }
);
