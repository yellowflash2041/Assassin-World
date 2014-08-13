import ModalFunctionality from 'discourse/mixins/modal-functionality';

import DiscourseController from 'discourse/controllers/controller';

export default DiscourseController.extend(ModalFunctionality, {

  selectedUploadId: function(){
      switch(this.get("selected")){
      case "system":
        return this.get("system_avatar_upload_id");
      case "gravatar":
        return this.get("gravatar_avatar_upload_id");
      default:
        return this.get("custom_avatar_upload_id");
      }
  }.property(
        'selected',
        'system_avatar_upload_id',
        'gravatar_avatar_upload_id',
        'custom_avatar_upload_id'),

  actions: {
    useUploadedAvatar: function() {
      this.set("selected", "uploaded");
    },
    useGravatar: function() {
      this.set("selected", "gravatar");
    },
    useSystem: function() {
      this.set("selected", "system");
    },
    refreshGravatar: function(){
      var self = this;
      self.set("gravatarRefreshDisabled", true);
      Discourse
          .ajax("/user_avatar/" + this.get("username") + "/refresh_gravatar", {method: 'POST'})
          .then(function(result){
            self.set("gravatarRefreshDisabled", false);
            self.set("gravatar_avatar_upload_id", result.upload_id);
          });
    }
  }
});
