import { queryAll } from "discourse/tests/helpers/qunit-helpers";
import { visit, click, fillIn } from "@ember/test-helpers";
import { test } from "qunit";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";

acceptance("Review", function (needs) {
  needs.user();

  const user = ".reviewable-item[data-reviewable-id=1234]";

  test("It returns a list of reviewable items", async (assert) => {
    await visit("/review");

    assert.ok(queryAll(".reviewable-item").length, "has a list of items");
    assert.ok(queryAll(user).length);
    assert.ok(
      queryAll(`${user}.reviewable-user`).length,
      "applies a class for the type"
    );
    assert.ok(
      queryAll(`${user} .reviewable-action.approve`).length,
      "creates a button for approve"
    );
    assert.ok(
      queryAll(`${user} .reviewable-action.reject`).length,
      "creates a button for reject"
    );
  });

  test("Grouped by topic", async (assert) => {
    await visit("/review/topics");
    assert.ok(
      queryAll(".reviewable-topic").length,
      "it has a list of reviewable topics"
    );
  });

  test("Settings", async (assert) => {
    await visit("/review/settings");

    assert.ok(
      queryAll(".reviewable-score-type").length,
      "has a list of bonuses"
    );

    const field = selectKit(".reviewable-score-type:eq(0) .field .combo-box");
    await field.expand();
    await field.selectRowByValue("5");
    await click(".save-settings");

    assert.ok(queryAll(".reviewable-settings .saved").length, "it saved");
  });

  test("Flag related", async (assert) => {
    await visit("/review");

    assert.ok(
      queryAll(".reviewable-flagged-post .post-contents .username a[href]")
        .length,
      "it has a link to the user"
    );

    assert.equal(
      queryAll(".reviewable-flagged-post .post-body").html().trim(),
      "<b>cooked content</b>"
    );

    assert.equal(
      queryAll(".reviewable-flagged-post .reviewable-score").length,
      2
    );
  });

  test("Flag related", async (assert) => {
    await visit("/review/1");

    assert.ok(
      queryAll(".reviewable-flagged-post").length,
      "it shows the flagged post"
    );
  });

  test("Clicking the buttons triggers actions", async (assert) => {
    await visit("/review");
    await click(`${user} .reviewable-action.approve`);
    assert.equal(
      queryAll(user).length,
      0,
      "it removes the reviewable on success"
    );
  });

  test("Editing a reviewable", async (assert) => {
    const topic = ".reviewable-item[data-reviewable-id=4321]";
    await visit("/review");
    assert.ok(queryAll(`${topic} .reviewable-action.approve`).length);
    assert.ok(!queryAll(`${topic} .category-name`).length);
    assert.equal(queryAll(`${topic} .discourse-tag:eq(0)`).text(), "hello");
    assert.equal(queryAll(`${topic} .discourse-tag:eq(1)`).text(), "world");

    assert.equal(
      queryAll(`${topic} .post-body`).text().trim(),
      "existing body"
    );

    await click(`${topic} .reviewable-action.edit`);
    await click(`${topic} .reviewable-action.save-edit`);
    assert.ok(
      queryAll(`${topic} .reviewable-action.approve`).length,
      "saving without changes is a cancel"
    );
    await click(`${topic} .reviewable-action.edit`);

    assert.equal(
      queryAll(`${topic} .reviewable-action.approve`).length,
      0,
      "when editing actions are disabled"
    );

    await fillIn(".editable-field.payload-raw textarea", "new raw contents");
    await click(`${topic} .reviewable-action.cancel-edit`);
    assert.equal(
      queryAll(`${topic} .post-body`).text().trim(),
      "existing body",
      "cancelling does not update the value"
    );

    await click(`${topic} .reviewable-action.edit`);
    let category = selectKit(`${topic} .category-id .select-kit`);
    await category.expand();
    await category.selectRowByValue("6");

    let tags = selectKit(`${topic} .payload-tags .mini-tag-chooser`);
    await tags.expand();
    await tags.fillInFilter("monkey");
    await tags.selectRowByValue("monkey");

    await fillIn(".editable-field.payload-raw textarea", "new raw contents");
    await click(`${topic} .reviewable-action.save-edit`);

    assert.equal(queryAll(`${topic} .discourse-tag:eq(0)`).text(), "hello");
    assert.equal(queryAll(`${topic} .discourse-tag:eq(1)`).text(), "world");
    assert.equal(queryAll(`${topic} .discourse-tag:eq(2)`).text(), "monkey");

    assert.equal(
      queryAll(`${topic} .post-body`).text().trim(),
      "new raw contents"
    );
    assert.equal(queryAll(`${topic} .category-name`).text().trim(), "support");
  });
});
