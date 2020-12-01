import * as ajaxlib from "discourse/lib/ajax";
import { module, test } from "qunit";
import Group from "discourse/models/group";
import User from "discourse/models/user";
import pretender from "discourse/tests/helpers/create-pretender";
import sinon from "sinon";

module("Unit | Model | user", function () {
  test("staff", function (assert) {
    var user = User.create({ id: 1, username: "eviltrout" });

    assert.ok(!user.get("staff"), "user is not staff");

    user.toggleProperty("moderator");
    assert.ok(user.get("staff"), "moderators are staff");

    user.setProperties({ moderator: false, admin: true });
    assert.ok(user.get("staff"), "admins are staff");
  });

  test("searchContext", function (assert) {
    var user = User.create({ id: 1, username: "EvilTrout" });

    assert.deepEqual(
      user.get("searchContext"),
      { type: "user", id: "eviltrout", user: user },
      "has a search context"
    );
  });

  test("isAllowedToUploadAFile", function (assert) {
    var user = User.create({ trust_level: 0, admin: true });
    assert.ok(
      user.isAllowedToUploadAFile("image"),
      "admin can always upload a file"
    );

    user.setProperties({ admin: false, moderator: true });
    assert.ok(
      user.isAllowedToUploadAFile("image"),
      "moderator can always upload a file"
    );
  });

  test("canMangeGroup", function (assert) {
    let user = User.create({ admin: true });
    let group = Group.create({ automatic: true });

    assert.equal(
      user.canManageGroup(group),
      false,
      "automatic groups cannot be managed."
    );

    group.set("automatic", false);
    group.setProperties({ can_admin_group: true });

    assert.equal(
      user.canManageGroup(group),
      true,
      "an admin should be able to manage the group"
    );

    user.set("admin", false);
    group.setProperties({ is_group_owner: true });

    assert.equal(
      user.canManageGroup(group),
      true,
      "a group owner should be able to manage the group"
    );
  });

  test("resolvedTimezone", function (assert) {
    const tz = "Australia/Brisbane";
    let user = User.create({ timezone: tz, username: "chuck", id: 111 });
    let stub = sinon.stub(moment.tz, "guess").returns("America/Chicago");

    pretender.put("/u/chuck.json", () => {
      return [200, { "Content-Type": "application/json" }, {}];
    });

    let spy = sinon.spy(ajaxlib, "ajax");
    assert.equal(
      user.resolvedTimezone(user),
      tz,
      "if the user already has a timezone return it"
    );
    assert.ok(
      spy.notCalled,
      "if the user already has a timezone do not call AJAX update"
    );
    user = User.create({ username: "chuck", id: 111 });
    assert.equal(
      user.resolvedTimezone(user),
      "America/Chicago",
      "if the user has no timezone guess it with moment"
    );
    assert.ok(
      spy.calledWith("/u/chuck.json", {
        type: "PUT",
        dataType: "json",
        data: { timezone: "America/Chicago" },
      }),
      "if the user has no timezone save it with an AJAX update"
    );

    let otherUser = User.create({ username: "howardhamlin", id: 999 });
    assert.equal(
      otherUser.resolvedTimezone(user),
      null,
      "if the user has no timezone and the user is not the current user, do NOT guess with moment"
    );
    assert.not(
      spy.calledWith("/u/howardhamlin.json", {
        type: "PUT",
        dataType: "json",
        data: { timezone: "America/Chicago" },
      }),
      "if the user has no timezone, and the user is not the current user, do NOT save it with an AJAX update"
    );

    stub.restore();
  });

  test("muted ids", function (assert) {
    let user = User.create({ username: "chuck", muted_category_ids: [] });

    assert.deepEqual(user.calculateMutedIds(0, 1, "muted_category_ids"), [1]);
    assert.deepEqual(user.calculateMutedIds(1, 1, "muted_category_ids"), []);
  });
});
