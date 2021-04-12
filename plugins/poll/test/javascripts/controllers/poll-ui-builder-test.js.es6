import { controllerModule } from "discourse/tests/helpers/qunit-helpers";
import {
  MULTIPLE_POLL_TYPE,
  NUMBER_POLL_TYPE,
  REGULAR_POLL_TYPE,
} from "discourse/plugins/poll/controllers/poll-ui-builder";

controllerModule("controller:poll-ui-builder", {
  setupController(controller) {
    controller.set("toolbarEvent", { getText: () => "" });
    controller.onShow();
  },
  needs: ["controller:modal"],
});

test("isMultiple", function (assert) {
  const controller = this.subject();

  controller.setProperties({
    pollType: MULTIPLE_POLL_TYPE,
    pollOptions: [{ value: "a" }],
  });

  assert.equal(controller.isMultiple, true, "it should be true");

  controller.setProperties({
    pollType: "random",
    pollOptions: [{ value: "b" }],
  });

  assert.equal(controller.isMultiple, false, "it should be false");
});

test("isNumber", function (assert) {
  const controller = this.subject();

  controller.set("pollType", REGULAR_POLL_TYPE);

  assert.equal(controller.isNumber, false, "it should be false");

  controller.set("pollType", NUMBER_POLL_TYPE);

  assert.equal(controller.isNumber, true, "it should be true");
});

test("pollOptionsCount", function (assert) {
  const controller = this.subject();

  controller.set("pollOptions", [{ value: "1" }, { value: "2" }]);

  assert.equal(controller.pollOptionsCount, 2, "it should equal 2");

  controller.set("pollOptions", []);

  assert.equal(controller.pollOptionsCount, 0, "it should equal 0");
});

test("disableInsert", function (assert) {
  const controller = this.subject();
  controller.siteSettings.poll_maximum_options = 20;

  assert.equal(controller.disableInsert, true, "it should be true");

  controller.set("pollOptions", [{ value: "a" }, { value: "b" }]);

  assert.equal(controller.disableInsert, false, "it should be false");

  controller.set("pollType", NUMBER_POLL_TYPE);

  assert.equal(controller.disableInsert, false, "it should be false");

  controller.setProperties({
    pollType: REGULAR_POLL_TYPE,
    pollOptions: [{ value: "a" }, { value: "b" }, { value: "c" }],
  });

  assert.equal(controller.disableInsert, false, "it should be false");

  controller.setProperties({
    pollType: REGULAR_POLL_TYPE,
    pollOptions: [],
  });

  assert.equal(controller.disableInsert, true, "it should be true");

  controller.setProperties({
    pollType: REGULAR_POLL_TYPE,
    pollOptions: [{ value: "w" }],
  });

  assert.equal(controller.disableInsert, false, "it should be false");
});

test("number pollOutput", function (assert) {
  const controller = this.subject();
  controller.siteSettings.poll_maximum_options = 20;

  controller.setProperties({
    pollType: NUMBER_POLL_TYPE,
    pollMin: 1,
  });

  assert.equal(
    controller.pollOutput,
    "[poll type=number results=always min=1 max=20 step=1]\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("pollStep", 2);

  assert.equal(
    controller.pollOutput,
    "[poll type=number results=always min=1 max=20 step=2]\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("publicPoll", true);

  assert.equal(
    controller.pollOutput,
    "[poll type=number results=always min=1 max=20 step=2 public=true]\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("pollStep", 0);

  assert.equal(
    controller.pollOutput,
    "[poll type=number results=always min=1 max=20 step=1 public=true]\n[/poll]\n",
    "it should return the right output"
  );
});

test("regular pollOutput", function (assert) {
  const controller = this.subject();
  controller.siteSettings.poll_maximum_options = 20;

  controller.setProperties({
    pollOptions: [{ value: "1" }, { value: "2" }],
    pollType: REGULAR_POLL_TYPE,
  });

  assert.equal(
    controller.pollOutput,
    "[poll type=regular results=always chartType=bar]\n* 1\n* 2\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("publicPoll", "true");

  assert.equal(
    controller.pollOutput,
    "[poll type=regular results=always public=true chartType=bar]\n* 1\n* 2\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("pollGroups", "test");

  assert.equal(
    controller.get("pollOutput"),
    "[poll type=regular results=always public=true chartType=bar groups=test]\n* 1\n* 2\n[/poll]\n",
    "it should return the right output"
  );
});

test("multiple pollOutput", function (assert) {
  const controller = this.subject();
  controller.siteSettings.poll_maximum_options = 20;

  controller.setProperties({
    pollType: MULTIPLE_POLL_TYPE,
    pollMin: 1,
    pollOptions: [{ value: "1" }, { value: "2" }],
  });

  assert.equal(
    controller.pollOutput,
    "[poll type=multiple results=always min=1 max=2 chartType=bar]\n* 1\n* 2\n[/poll]\n",
    "it should return the right output"
  );

  controller.set("publicPoll", "true");

  assert.equal(
    controller.pollOutput,
    "[poll type=multiple results=always min=1 max=2 public=true chartType=bar]\n* 1\n* 2\n[/poll]\n",
    "it should return the right output"
  );
});

test("staff_only option is not present for non-staff", function (assert) {
  const controller = this.subject();
  controller.currentUser = { staff: false };

  assert.ok(
    controller.pollResults.filterBy("value", "staff_only").length === 0,
    "staff_only is not present"
  );
});

test("poll result is always by default", function (assert) {
  const controller = this.subject();
  assert.equal(controller.pollResult, "always");
});

test("staff_only option is present for staff", function (assert) {
  const controller = this.subject();
  controller.currentUser = { staff: true };

  assert.ok(
    controller.pollResults.filterBy("value", "staff_only").length === 1,
    "staff_only is present"
  );
});
