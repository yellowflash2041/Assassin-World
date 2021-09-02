import EmberObject from "@ember/object";
import I18n from "I18n";
import Mixin from "@ember/object/mixin";
import discourseComputed from "discourse-common/utils/decorators";
import { isEmpty } from "@ember/utils";

export default Mixin.create({
  @discourseComputed()
  nameInstructions() {
    return I18n.t(
      this.siteSettings.full_name_required
        ? "user.name.instructions_required"
        : "user.name.instructions"
    );
  },

  // Validate the name.
  @discourseComputed("accountName")
  nameValidation() {
    if (this.siteSettings.full_name_required && isEmpty(this.accountName)) {
      return EmberObject.create({
        failed: true,
        message: I18n.t("user.name.required"),
        element: document.querySelector("#new-account-name"),
      });
    }

    return EmberObject.create({ ok: true });
  },
});
