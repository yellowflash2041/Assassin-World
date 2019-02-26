moduleFor("controller:preferences/account");

QUnit.skip("updating of associated accounts", function(assert) {
  const controller = this.subject({
    siteSettings: {
      enable_google_oauth2_logins: true
    },
    model: Ember.Object.create({
      second_factor_enabled: true
    }),
    site: Ember.Object.create({
      isMobileDevice: false
    })
  });

  controller.set("canCheckEmails", false);

  assert.equal(controller.get("canUpdateAssociatedAccounts"), false);

  controller.set("model.second_factor_enabled", false);

  assert.equal(controller.get("canUpdateAssociatedAccounts"), false);

  controller.set("canCheckEmails", true);

  assert.equal(controller.get("canUpdateAssociatedAccounts"), true);
});
