import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render } from "@ember/test-helpers";
import { exists } from "discourse/tests/helpers/qunit-helpers";
import { hbs } from "ember-cli-htmlbars";

module(
  "Integration | Component | Widget | post-small-action",
  function (hooks) {
    setupRenderingTest(hooks);

    test("does not have delete/edit/recover buttons by default", async function (assert) {
      this.set("args", { id: 123 });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(!exists(".small-action-desc > .small-action-delete"));
      assert.ok(!exists(".small-action-desc > .small-action-recover"));
      assert.ok(!exists(".small-action-desc > .small-action-edit"));
    });

    test("shows edit button if canEdit", async function (assert) {
      this.set("args", { id: 123, canEdit: true });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(
        exists(".small-action-desc > .small-action-edit"),
        "it adds the edit small action button"
      );
    });

    test("uses custom widget if actionDescriptionWidget", async function (assert) {
      this.set("args", { id: 123, actionDescriptionWidget: "button" });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(
        exists(".small-action .widget-button"),
        "it adds the custom widget"
      );
    });

    test("does not show edit button if canRecover even if canEdit", async function (assert) {
      this.set("args", { id: 123, canEdit: true, canRecover: true });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(
        !exists(".small-action-desc > .small-action-edit"),
        "it does not add the edit small action button"
      );
      assert.ok(
        exists(".small-action-desc > .small-action-recover"),
        "it adds the recover small action button"
      );
    });

    test("shows delete button if canDelete", async function (assert) {
      this.set("args", { id: 123, canDelete: true });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(
        exists(".small-action-desc > .small-action-delete"),
        "it adds the delete small action button"
      );
    });

    test("shows undo button if canRecover", async function (assert) {
      this.set("args", { id: 123, canRecover: true });

      await render(
        hbs`<MountWidget @widget="post-small-action" @args={{this.args}} />`
      );

      assert.ok(
        exists(".small-action-desc > .small-action-recover"),
        "it adds the recover small action button"
      );
    });
  }
);
