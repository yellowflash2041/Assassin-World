import computed from "ember-addons/ember-computed-decorators";
import UploadMixin from "discourse/mixins/upload";

export default Ember.Component.extend(UploadMixin, {
  type: "avatar",
  tagName: "span",
  imageIsNotASquare: false,

  validateUploadedFilesOptions() {
    return { imagesOnly: true };
  },

  uploadDone(upload) {
    this.setProperties({
      imageIsNotASquare: upload.width !== upload.height,
      uploadedAvatarTemplate: upload.url,
      uploadedAvatarId: upload.id
    });

    this.done();
  },

  @computed("user_id")
  data(user_id) {
    return { user_id };
  }
});
