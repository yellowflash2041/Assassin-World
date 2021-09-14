import {
  acceptance,
  count,
  exists,
  query,
  queryAll,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";

acceptance("User Drafts", function (needs) {
  needs.user();

  test("Stream", async function (assert) {
    await visit("/u/eviltrout/activity/drafts");
    assert.equal(count(".user-stream-item"), 3, "has drafts");

    await click(".user-stream-item:last-child .remove-draft");
    assert.ok(visible(".bootbox"));

    await click(".bootbox .btn-primary");
    assert.equal(
      count(".user-stream-item"),
      2,
      "draft removed, list length diminished by one"
    );
  });

  test("Stream - resume draft", async function (assert) {
    await visit("/u/eviltrout/activity/drafts");
    assert.ok(exists(".user-stream-item"), "has drafts");

    await click(".user-stream-item .resume-draft");
    assert.equal(
      queryAll(".d-editor-input").val().trim(),
      "A fun new topic for testing drafts."
    );
  });

  test("Stream - has excerpt", async function (assert) {
    await visit("/u/eviltrout/activity/drafts");
    assert.ok(exists(".user-stream-item"), "has drafts");
    assert.equal(
      query(".user-stream-item:nth-child(3) .category").textContent,
      "meta"
    );
    assert.equal(
      query(".user-stream-item:nth-child(3) .excerpt").innerHTML.trim(),
      'here goes a reply to a PM <img src="/images/emoji/google_classic/slight_smile.png?v=10" title=":slight_smile:" class="emoji" alt=":slight_smile:">'
    );
  });
});
