import {
  acceptance,
  count,
  exists,
  query,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";
import I18n from "I18n";

acceptance("Admin - Watched Words", function (needs) {
  needs.user();

  test("list words in groups", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");

    assert.ok(!exists(".admin-watched-words .alert-error"));

    assert.ok(
      !exists(".watched-words-list"),
      "Don't show bad words by default."
    );

    assert.ok(
      !exists(".watched-words-list .watched-word"),
      "Don't show bad words by default."
    );

    await fillIn(".admin-controls .controls input[type=text]", "li");

    assert.strictEqual(
      count(".watched-words-list .watched-word"),
      1,
      "When filtering, show words even if checkbox is unchecked."
    );

    await fillIn(".admin-controls .controls input[type=text]", "");

    assert.ok(
      !exists(".watched-words-list .watched-word"),
      "Clearing the filter hides words again."
    );

    await click(".show-words-checkbox");

    assert.ok(
      exists(".watched-words-list .watched-word"),
      "Always show the words when checkbox is checked."
    );

    await click(".nav-stacked .censor a");

    assert.ok(exists(".watched-words-list"));
    assert.ok(!exists(".watched-words-list .watched-word"), "Empty word list.");
  });

  test("add words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");

    click(".show-words-checkbox");
    fillIn(".watched-word-form input", "poutine");

    await click(".watched-word-form button");

    let found = [];
    [...queryAll(".watched-words-list .watched-word")].forEach((elem) => {
      if (elem.innerText.trim() === "poutine") {
        found.push(true);
      }
    });

    assert.strictEqual(found.length, 1);
    assert.strictEqual(count(".watched-words-list .case-sensitive"), 0);
  });

  test("add case-sensitve words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");

    click(".show-words-checkbox");
    fillIn(".watched-word-form input", "Discourse");
    click(".case-sensitivity-checkbox");

    await click(".watched-word-form button");

    assert
      .dom(".watched-words-list .watched-word")
      .hasText(`Discourse ${I18n.t("admin.watched_words.case_sensitive")}`);

    fillIn(".watched-word-form input", "discourse");
    click(".case-sensitivity-checkbox");
    await click(".watched-word-form button");

    assert
      .dom(".watched-words-list .watched-word")
      .hasText(`discourse ${I18n.t("admin.watched_words.case_sensitive")}`);
  });

  test("remove words", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    await click(".show-words-checkbox");

    let wordId = null;

    [...queryAll(".watched-words-list .watched-word")].forEach((elem) => {
      if (elem.innerText.trim() === "anise") {
        wordId = elem.getAttribute("id");
      }
    });

    await click(`#${wordId} .delete-word-record`);

    assert.strictEqual(count(".watched-words-list .watched-word"), 2);
  });

  test("test modal - replace", async function (assert) {
    await visit("/admin/customize/watched_words/action/replace");
    await click(".watched-word-test");
    await fillIn(".modal-body textarea", "Hi there!");
    assert.strictEqual(query(".modal-body li .match").innerText, "Hi");
    assert.strictEqual(query(".modal-body li .replacement").innerText, "hello");
  });

  test("test modal - tag", async function (assert) {
    await visit("/admin/customize/watched_words/action/tag");
    await click(".watched-word-test");
    await fillIn(".modal-body textarea", "Hello world!");
    assert.strictEqual(query(".modal-body li .match").innerText, "Hello");
    assert.strictEqual(query(".modal-body li .tag").innerText, "greeting");
  });
});

acceptance("Admin - Watched Words - Bad regular expressions", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.get("/admin/customize/watched_words.json", () => {
      return helper.response({
        actions: ["block", "censor", "require_approval", "flag", "replace"],
        words: [
          {
            id: 1,
            word: "[.*",
            regexp: "[.*",
            action: "block",
          },
        ],
        compiled_regular_expressions: {
          block: null,
          censor: null,
          require_approval: null,
          flag: null,
          replace: null,
        },
      });
    });
  });

  test("shows an error message if regex is invalid", async function (assert) {
    await visit("/admin/customize/watched_words/action/block");
    assert.strictEqual(count(".admin-watched-words .alert-error"), 1);
  });
});
