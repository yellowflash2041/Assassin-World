import I18n from "I18n";

import { test } from "qunit";
import { click, visit } from "@ember/test-helpers";
import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";

acceptance("Sidebar - Anon User", function () {
  // Don't show sidebar for anon user until we know what we want to display
  test("sidebar is not displayed", async function (assert) {
    await visit("/");

    assert.ok(
      !document.body.classList.contains("has-sidebar-page"),
      "does not add sidebar utility class to body"
    );

    assert.ok(!exists(".sidebar-container"));
  });
});

acceptance(
  "Sidebar - Experimental sidebar and hamburger setting disabled",
  function (needs) {
    needs.user();

    needs.settings({
      enable_experimental_sidebar_hamburger: false,
    });

    test("clicking header hamburger icon displays old hamburger drodown", async function (assert) {
      await visit("/");
      await click(".hamburger-dropdown");

      assert.ok(exists(".menu-container-general-links"));
    });
  }
);

acceptance(
  "Sidebar - Experimental sidebar and hamburger setting enabled - Sidebar disabled",
  function (needs) {
    needs.user();

    needs.settings({
      enable_experimental_sidebar_hamburger: true,
      enable_sidebar: false,
    });

    test("showing and hiding sidebar", async function (assert) {
      await visit("/");
      await click(".hamburger-dropdown");

      assert.ok(
        exists(".sidebar-hamburger-dropdown"),
        "displays the sidebar dropdown"
      );

      await click(".hamburger-dropdown");

      assert.notOk(
        exists(".sidebar-hamburger-dropdown"),
        "hides the sidebar dropdown"
      );
    });

    test("'enable_sidebar' query param override to enable sidebar", async function (assert) {
      await visit("/?enable_sidebar=1");

      assert.ok(exists(".sidebar-container"), "sidebar is displayed");

      await click(".btn-sidebar-toggle");

      assert.notOk(
        exists(".sidebar-hamburger-dropdown"),
        "does not display the sidebar dropdown"
      );

      assert.notOk(exists(".sidebar-container"), "sidebar is hidden");

      await click(".btn-sidebar-toggle");

      assert.ok(exists(".sidebar-container"), "sidebar is displayed");
    });
  }
);

acceptance(
  "Sidebar - Experimental sidebar and hamburger setting enabled - Sidebar enabled",
  function (needs) {
    needs.user();

    needs.settings({
      enable_experimental_sidebar_hamburger: true,
      enable_sidebar: true,
    });

    test("viewing keyboard shortcuts using sidebar", async function (assert) {
      await visit("/");
      await click(
        `.sidebar-footer-actions-keyboard-shortcuts[title="${I18n.t(
          "keyboard_shortcuts_help.title"
        )}"]`
      );

      assert.ok(
        exists("#keyboard-shortcuts-help"),
        "keyboard shortcuts help is displayed"
      );
    });

    test("sidebar is disabled on wizard route", async function (assert) {
      await visit("/wizard");

      assert.notOk(
        exists(".sidebar-container"),
        "does not display the sidebar on wizard route"
      );

      await click(".hamburger-dropdown");

      assert.ok(
        exists(".sidebar-hamburger-dropdown"),
        "navigation around the site can still be done via the sidebar hamburger"
      );
    });

    test("showing and hiding sidebar", async function (assert) {
      await visit("/");

      assert.ok(
        document.body.classList.contains("has-sidebar-page"),
        "adds sidebar utility class to body"
      );

      assert.ok(
        exists(".sidebar-container"),
        "displays the sidebar by default"
      );

      await click(".btn-sidebar-toggle");

      assert.ok(
        !document.body.classList.contains("has-sidebar-page"),
        "removes sidebar utility class from body"
      );

      assert.ok(!exists(".sidebar-container"), "hides the sidebar");

      await click(".btn-sidebar-toggle");

      assert.ok(exists(".sidebar-container"), "displays the sidebar");
    });

    test("'enable_sidebar' query param override to disable sidebar", async function (assert) {
      await visit("/?enable_sidebar=0");

      assert.notOk(exists(".sidebar-container"), "sidebar is not displayed");

      await click(".hamburger-dropdown");

      assert.ok(
        exists(".sidebar-hamburger-dropdown"),
        "displays the sidebar dropdown"
      );

      await click(".hamburger-dropdown");

      assert.notOk(
        exists(".sidebar-hamburger-dropdown"),
        "hides the sidebar dropdown"
      );
    });

    test("button to toggle between mobile and desktop view on touch devices ", async function (assert) {
      const capabilities = this.container.lookup("capabilities:main");
      capabilities.touch = true;

      await visit("/");

      assert.ok(
        exists(
          `.sidebar-footer-actions-toggle-mobile-view[title="${I18n.t(
            "mobile_view"
          )}"]`
        ),
        "displays the right title for the button"
      );

      assert.ok(
        exists(".sidebar-footer-actions-toggle-mobile-view .d-icon-mobile-alt"),
        "displays the mobile icon for the button"
      );
    });
  }
);
