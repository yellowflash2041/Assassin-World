import { url } from "discourse/lib/computed";
import { default as computed } from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  section: null,
  currentTarget: 0,
  maximized: false,
  previewUrl: url("model.id", "/admin/themes/%@/preview"),
  showAdvanced: false,
  editRouteName: "adminCustomizeThemes.edit",
  showRouteName: "adminCustomizeThemes.show",

  setTargetName: function(name) {
    const target = this.get("model.targets").find(t => t.name === name);
    this.set("currentTarget", target && target.id);
  },

  @computed("currentTarget")
  currentTargetName(id) {
    const target = this.get("model.targets").find(
      t => t.id === parseInt(id, 10)
    );
    return target && target.name;
  },

  @computed("model.isSaving")
  saveButtonText(isSaving) {
    return isSaving ? I18n.t("saving") : I18n.t("admin.customize.save");
  },

  @computed("model.changed", "model.isSaving")
  saveDisabled(changed, isSaving) {
    return !changed || isSaving;
  },

  actions: {
    save() {
      this.set("saving", true);
      this.get("model")
        .saveChanges("theme_fields")
        .finally(() => {
          this.set("saving", false);
        });
    },

    fieldAdded(target, name) {
      this.replaceRoute(
        this.get("editRouteName"),
        this.get("model.id"),
        target,
        name
      );
    },

    onlyOverriddenChanged(onlyShowOverridden) {
      if (onlyShowOverridden) {
        if (
          !this.get("model").hasEdited(
            this.get("currentTargetName"),
            this.get("fieldName")
          )
        ) {
          let firstTarget = this.get("model.targets").find(t => t.edited);
          let firstField = this.get(`model.fields.${firstTarget.name}`).find(
            f => f.edited
          );

          this.replaceRoute(
            this.get("editRouteName"),
            this.get("model.id"),
            firstTarget.name,
            firstField.name
          );
        }
      }
    }
  }
});
