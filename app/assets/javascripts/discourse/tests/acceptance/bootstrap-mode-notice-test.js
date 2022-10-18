import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { click, currentURL, settled, visit } from "@ember/test-helpers";
import { set } from "@ember/object";

acceptance("Bootstrap Mode Notice", function (needs) {
  needs.user();
  needs.site({ wizard_required: true });
  needs.settings({
    bootstrap_mode_enabled: true,
    bootstrap_mode_min_users: 50,
  });

  test("Navigation", async function (assert) {
    await visit("/");
    assert.ok(
      exists(".bootstrap-mode-notice"),
      "has the bootstrap mode notice"
    );
    assert.ok(
      exists(".bootstrap-invite-button"),
      "bootstrap notice has invite button"
    );
    assert.ok(
      exists(".bootstrap-wizard-link"),
      "bootstrap notice has wizard link"
    );

    await click(".bootstrap-invite-button");
    assert.ok(exists(".create-invite-modal"), "opens create invite modal");

    await click(".bootstrap-wizard-link");
    assert.strictEqual(
      currentURL(),
      "/wizard/steps/hello-world",
      "it transitions to the wizard page"
    );

    await visit("/");
    set(this.siteSettings, "bootstrap_mode_enabled", false);
    await settled();
    assert.ok(
      !exists(".bootstrap-mode-notice"),
      "removes the notice when bootstrap mode is disabled"
    );
  });
});
