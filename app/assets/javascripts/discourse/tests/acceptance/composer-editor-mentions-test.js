import { test } from "qunit";
import { click, fillIn, triggerKeyEvent, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { setCaretPosition } from "discourse/lib/utilities";

acceptance("Composer - editor mentions", function (needs) {
  needs.user();
  needs.settings({ enable_mentions: true });

  needs.pretender((server, helper) => {
    server.get("/u/search/users", () => {
      return helper.response({
        users: [
          {
            username: "user",
            name: "Some User",
            avatar_template:
              "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
            status: {
              emoji: "tooth",
              description: "off to dentist",
            },
          },
          {
            username: "user2",
            name: "Some User",
            avatar_template:
              "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
          },
        ],
      });
    });
  });

  test("selecting user mentions", async function (assert) {
    await visit("/");
    await click("#create-topic");

    // Emulate user pressing backspace in the editor
    const editor = query(".d-editor-input");

    await triggerKeyEvent(".d-editor-input", "keydown", "@");
    await fillIn(".d-editor-input", "abc @");
    await setCaretPosition(editor, 5);
    await triggerKeyEvent(".d-editor-input", "keyup", "@");

    await triggerKeyEvent(".d-editor-input", "keydown", "U");
    await fillIn(".d-editor-input", "abc @u");
    await setCaretPosition(editor, 6);
    await triggerKeyEvent(".d-editor-input", "keyup", "U");

    await click(".autocomplete.ac-user .selected");

    assert.strictEqual(
      query(".d-editor-input").value,
      "abc @user ",
      "should replace mention correctly"
    );
  });

  test("selecting user mentions after deleting characters", async function (assert) {
    await visit("/");
    await click("#create-topic");
    await fillIn(".d-editor-input", "abc @user a");

    // Emulate user typing `@` and `u` in the editor
    await triggerKeyEvent(".d-editor-input", "keydown", "Backspace");
    await fillIn(".d-editor-input", "abc @user ");
    await triggerKeyEvent(".d-editor-input", "keyup", "Backspace");

    await triggerKeyEvent(".d-editor-input", "keydown", "Backspace");
    await fillIn(".d-editor-input", "abc @user");
    await triggerKeyEvent(".d-editor-input", "keyup", "Backspace");

    await click(".autocomplete.ac-user .selected");

    assert.strictEqual(
      query(".d-editor-input").value,
      "abc @user ",
      "should replace mention correctly"
    );
  });

  test("selecting user mentions after deleting characters mid sentence", async function (assert) {
    await visit("/");
    await click("#create-topic");

    // Emulate user pressing backspace in the editor
    const editor = query(".d-editor-input");
    await fillIn(".d-editor-input", "abc @user 123");
    await setCaretPosition(editor, 9);

    await triggerKeyEvent(".d-editor-input", "keydown", "Backspace");
    await fillIn(".d-editor-input", "abc @use 123");
    await triggerKeyEvent(".d-editor-input", "keyup", "Backspace");
    await setCaretPosition(editor, 8);

    await triggerKeyEvent(".d-editor-input", "keydown", "Backspace");
    await fillIn(".d-editor-input", "abc @us 123");
    await triggerKeyEvent(".d-editor-input", "keyup", "Backspace");
    await setCaretPosition(editor, 7);

    await click(".autocomplete.ac-user .selected");

    assert.strictEqual(
      query(".d-editor-input").value,
      "abc @user 123",
      "should replace mention correctly"
    );
  });

  test("shows status on search results when mentioning a user", async function (assert) {
    await visit("/");
    await click("#create-topic");

    // emulate typing in "abc @u"
    const editor = query(".d-editor-input");
    await fillIn(".d-editor-input", "@");
    await setCaretPosition(editor, 5);
    await triggerKeyEvent(".d-editor-input", "keyup", "@");
    await fillIn(".d-editor-input", "@u");
    await setCaretPosition(editor, 6);
    await triggerKeyEvent(".d-editor-input", "keyup", "U");

    assert.ok(exists(".autocomplete .emoji[title='off to dentist']"));
  });
});
