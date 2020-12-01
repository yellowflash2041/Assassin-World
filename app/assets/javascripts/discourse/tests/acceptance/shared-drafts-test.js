import { acceptance, queryAll } from "discourse/tests/helpers/qunit-helpers";
import { click, visit } from "@ember/test-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { test } from "qunit";

acceptance("Shared Drafts", function () {
  test("Viewing", async function (assert) {
    await visit("/t/some-topic/9");
    assert.ok(queryAll(".shared-draft-controls").length === 1);
    let categoryChooser = selectKit(".shared-draft-controls .category-chooser");
    assert.equal(categoryChooser.header().value(), "3");

    await click(".publish-shared-draft");
    await click(".bootbox .btn-primary");

    assert.ok(queryAll(".shared-draft-controls").length === 0);
  });
});
