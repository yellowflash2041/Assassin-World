import { acceptance } from "helpers/qunit-helpers";

acceptance("Create Account - external auth", {
  beforeEach() {
    const node = document.createElement("meta");
    node.dataset.authenticationData = JSON.stringify({
      auth_provider: "test",
      email: "blah@example.com",
      can_edit_username: true,
      can_edit_name: true
    });
    node.id = "data-authentication";
    document.querySelector("head").appendChild(node);
  },
  afterEach() {
    document
      .querySelector("head")
      .removeChild(document.getElementById("data-authentication"));
  }
});

QUnit.test("when skip is disabled (default)", async assert => {
  await visit("/");

  assert.ok(
    exists("#discourse-modal div.create-account"),
    "it shows the registration modal"
  );

  assert.ok(exists("#new-account-username"), "it shows the fields");
});

QUnit.test("when skip is enabled", async function(assert) {
  this.siteSettings.external_auth_skip_create_confirm = true;
  await visit("/");

  assert.ok(
    exists("#discourse-modal div.create-account"),
    "it shows the registration modal"
  );

  assert.not(exists("#new-account-username"), "it does not show the fields");
});
