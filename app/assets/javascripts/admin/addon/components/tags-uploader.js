import Component from "@ember/component";
import I18n from "I18n";
import UppyUploadMixin from "discourse/mixins/uppy-upload";
import { alias } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default Component.extend(UppyUploadMixin, {
  type: "csv",
  dialog: service(),
  uploadUrl: "/tags/upload",
  addDisabled: alias("uploading"),
  elementId: "tag-uploader",
  preventDirectS3Uploads: true,

  validateUploadedFilesOptions() {
    return { csvOnly: true };
  },

  uploadDone() {
    this.closeModal();
    this.refresh();
    this.dialog.alert(I18n.t("tagging.upload_successful"));
  },
});
