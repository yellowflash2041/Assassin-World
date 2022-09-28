import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { fillIn, render } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { exists, paste, query } from "discourse/tests/helpers/qunit-helpers";
import pretender, { response } from "../../../helpers/create-pretender";

module(
  "Integration | Component | select-kit/email-group-user-chooser",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set("subject", selectKit());
    });

    test("pasting", async function (assert) {
      await render(hbs`<EmailGroupUserChooser/>`);

      await this.subject.expand();
      await paste(query(".filter-input"), "foo,bar");

      assert.equal(this.subject.header().value(), "foo,bar");
    });

    test("doesn't show user status by default", async function (assert) {
      pretender.get("/u/search/users", () =>
        response({
          users: [
            {
              username: "test-user",
              status: {
                description: "off to dentist",
                emoji: "tooth",
              },
            },
          ],
        })
      );

      await render(hbs`<EmailGroupUserChooser />`);
      await this.subject.expand();
      await fillIn(".filter-input", "test-user");

      assert.notOk(exists(".user-status-message"));
    });

    test("shows user status if enabled", async function (assert) {
      const status = {
        description: "off to dentist",
        emoji: "tooth",
      };
      pretender.get("/u/search/users", () =>
        response({
          users: [
            {
              username: "test-user",
              status,
            },
          ],
        })
      );

      await render(hbs`<EmailGroupUserChooser @showUserStatus=true />`);
      await this.subject.expand();
      await fillIn(".filter-input", "test-user");

      assert.ok(exists(".user-status-message"), "user status is rendered");
      assert.equal(
        query(".user-status-message .emoji").alt,
        status.emoji,
        "status emoji is correct"
      );
      assert.equal(
        query(
          ".user-status-message .user-status-message-description"
        ).innerText.trim(),
        status.description,
        "status description is correct"
      );
    });
  }
);
