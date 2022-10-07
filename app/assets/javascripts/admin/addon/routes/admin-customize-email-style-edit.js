import I18n from "I18n";
import Route from "@ember/routing/route";
import { inject as service } from "@ember/service";

export default Route.extend({
  dialog: service(),
  model(params) {
    return {
      model: this.modelFor("adminCustomizeEmailStyle"),
      fieldName: params.field_name,
    };
  },

  setupController(controller, model) {
    controller.setProperties({
      fieldName: model.fieldName,
      model: model.model,
    });
    this._shouldAlertUnsavedChanges = true;
  },

  actions: {
    willTransition(transition) {
      if (
        this.get("controller.model.changed") &&
        this._shouldAlertUnsavedChanges &&
        transition.intent.name !== this.routeName
      ) {
        transition.abort();
        this.dialog.confirm({
          message: I18n.t("admin.customize.theme.unsaved_changes_alert"),
          confirmButtonLabel: "admin.customize.theme.discard",
          cancelButtonLabel: "admin.customize.theme.stay",
          didConfirm: () => {
            this._shouldAlertUnsavedChanges = false;
            transition.retry();
          },
        });
      }
    },
  },
});
