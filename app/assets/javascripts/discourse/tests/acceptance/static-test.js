import { acceptance, exists } from "discourse/tests/helpers/qunit-helpers";
import { currentRouteName, visit } from "@ember/test-helpers";
import { test } from "qunit";

acceptance("Static", function () {
  test("Static Pages", async function (assert) {
    await visit("/faq");
    assert.ok(
      document.body.classList.contains("static-faq"),
      "has the body class"
    );
    assert.ok(exists(".body-page"), "The content is present");

    await visit("/guidelines");
    assert.ok(
      document.body.classList.contains("static-guidelines"),
      "has the body class"
    );
    assert.ok(exists(".body-page"), "The content is present");

    await visit("/tos");
    assert.ok(
      document.body.classList.contains("static-tos"),
      "has the body class"
    );
    assert.ok(exists(".body-page"), "The content is present");

    await visit("/privacy");
    assert.ok(
      document.body.classList.contains("static-privacy"),
      "has the body class"
    );
    assert.ok(exists(".body-page"), "The content is present");

    await visit("/login");
    assert.strictEqual(
      currentRouteName(),
      "discovery.latest",
      "it redirects them to latest unless `login_required`"
    );
  });
});
