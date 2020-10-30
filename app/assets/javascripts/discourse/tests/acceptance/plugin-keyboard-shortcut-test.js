import { visit } from "@ember/test-helpers";
import { test } from "qunit";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";
import { withPluginApi } from "discourse/lib/plugin-api";
import KeyboardShortcuts from "discourse/lib/keyboard-shortcuts";
import KeyboardShortcutInitializer from "discourse/initializers/keyboard-shortcuts";
import sinon from "sinon";

acceptance("Plugin Keyboard Shortcuts - Logged In", function (needs) {
  needs.user();
  needs.hooks.beforeEach(function () {
    KeyboardShortcutInitializer.initialize(this.container);
  });
  test("a plugin can add a keyboard shortcut", async function (assert) {
    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("]", () => {
        $("#qunit-fixture").html(
          "<div id='added-element'>Test adding plugin shortcut</div>"
        );
      });
    });

    await visit("/t/this-is-a-test-topic/9");
    await keyEvent(document, "keypress", "]".charCodeAt(0));
    assert.equal(
      $("#added-element").length,
      1,
      "the keyboard shortcut callback fires successfully"
    );
  });
});

acceptance("Plugin Keyboard Shortcuts - Anonymous", function (needs) {
  needs.hooks.beforeEach(function () {
    KeyboardShortcutInitializer.initialize(this.container);
  });
  test("a plugin can add a keyboard shortcut with an option", async function (assert) {
    let spy = sinon.spy(KeyboardShortcuts, "_bindToPath");
    withPluginApi("0.8.38", (api) => {
      api.addKeyboardShortcut("]", () => {}, {
        anonymous: true,
        path: "test-path",
      });
    });

    assert.ok(
      spy.calledWith("test-path", "]"),
      "bindToPath is called due to options provided"
    );
  });
});
