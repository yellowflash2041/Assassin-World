import Component from "@ember/component";
import I18n from "I18n";
import { dasherize } from "@ember/string";
import discourseComputed from "discourse-common/utils/decorators";
import { getOwner } from "discourse-common/lib/get-owner";
import { getToken } from "wizard/lib/ajax";
import getUrl from "discourse-common/lib/get-url";

export default Component.extend({
  classNames: ["wizard-image-row"],
  uploading: false,

  @discourseComputed("field.id")
  previewComponent(id) {
    const componentName = `image-preview-${dasherize(id)}`;
    const exists = getOwner(this).lookup(`component:${componentName}`);
    return exists ? componentName : "wizard-image-preview";
  },

  didInsertElement() {
    this._super(...arguments);

    const $upload = $(this.element);

    const id = this.get("field.id");

    $upload.fileupload({
      url: getUrl("/uploads.json"),
      formData: {
        synchronous: true,
        type: `wizard_${id}`,
        authenticity_token: getToken(),
      },
      dataType: "json",
      dropZone: $upload,
    });

    $upload.on("fileuploadsubmit", () => this.set("uploading", true));

    $upload.on("fileuploaddone", (e, response) => {
      this.set("field.value", response.result.url);
      this.set("uploading", false);
    });

    $upload.on("fileuploadfail", (e, response) => {
      let message = I18n.t("wizard.upload_error");
      if (response.jqXHR.responseJSON && response.jqXHR.responseJSON.errors) {
        message = response.jqXHR.responseJSON.errors.join("\n");
      }

      window.bootbox.alert(message);
      this.set("uploading", false);
    });
  },
});
