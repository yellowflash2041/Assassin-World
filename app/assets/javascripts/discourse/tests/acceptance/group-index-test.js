import {
  acceptance,
  count,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, visit } from "@ember/test-helpers";
import I18n from "I18n";
import { test } from "qunit";

acceptance("Group Members - Anonymous", function () {
  test("Viewing Members as anon user", async function (assert) {
    await visit("/g/discourse");

    assert.ok(
      count(".avatar-flair .d-icon-adjust") === 1,
      "it displays the group's avatar flair"
    );
    assert.ok(count(".group-members tr") > 0, "it lists group members");

    assert.ok(
      count(".group-member-dropdown") === 0,
      "it does not allow anon user to manage group members"
    );

    assert.equal(
      queryAll(".group-username-filter").attr("placeholder"),
      I18n.t("groups.members.filter_placeholder"),
      "it should display the right filter placehodler"
    );
  });
});

acceptance("Group Members", function (needs) {
  needs.user();

  test("Viewing Members as a group owner", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false });

    await visit("/g/discourse");
    await click(".group-members-add");

    assert.equal(
      queryAll("#group-add-members-user-selector").length,
      1,
      "it should display the add members modal"
    );
  });

  test("Viewing Members as an admin user", async function (assert) {
    await visit("/g/discourse");

    assert.ok(
      count(".group-member-dropdown") > 0,
      "it allows admin user to manage group members"
    );

    assert.equal(
      queryAll(".group-username-filter").attr("placeholder"),
      I18n.t("groups.members.filter_placeholder_admin"),
      "it should display the right filter placehodler"
    );
  });
});
