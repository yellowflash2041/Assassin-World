import { test } from "qunit";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";

acceptance("Signing In - Mobile", { mobileView: true });

test("sign in", async (assert) => {
  await visit("/");
  await click("header .login-button");
  assert.ok(exists("#login-form"), "it shows the login modal");
});
