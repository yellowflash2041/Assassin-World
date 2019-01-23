import ApiKey from "admin/models/api-key";
import { default as computed } from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  @computed("model.[]")
  hasMasterKey(model) {
    return !!model.findBy("user", null);
  },

  actions: {
    generateMasterKey() {
      ApiKey.generateMasterKey().then(key => this.get("model").pushObject(key));
    },

    regenerateKey(key) {
      bootbox.confirm(
        I18n.t("admin.api.confirm_regen"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        result => {
          if (result) {
            key.regenerate();
          }
        }
      );
    },

    revokeKey(key) {
      bootbox.confirm(
        I18n.t("admin.api.confirm_revoke"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        result => {
          if (result) {
            key.revoke().then(() => this.get("model").removeObject(key));
          }
        }
      );
    }
  }
});
