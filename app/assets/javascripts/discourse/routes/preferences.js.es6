import ShowFooter from "discourse/mixins/show-footer";
import RestrictedUserRoute from "discourse/routes/restricted-user";

export default RestrictedUserRoute.extend(ShowFooter, {
  model: function() {
    return this.modelFor('user');
  },

  setupController: function(controller, user) {
    controller.setProperties({ model: user, newNameInput: user.get('name') });
  },

  actions: {
    showAvatarSelector: function() {
      Discourse.Route.showModal(this, 'avatar-selector');

      // all the properties needed for displaying the avatar selector modal
      var controller = this.controllerFor('avatar-selector');
      var user = this.modelFor('user');
      var props = user.getProperties(
        'username', 'email',
        'uploaded_avatar_id',
        'system_avatar_upload_id',
        'gravatar_avatar_upload_id',
        'custom_avatar_upload_id'
      );

      switch (props.uploaded_avatar_id) {
        case props.system_avatar_upload_id:
          props.selected = "system";
          break;
        case props.gravatar_avatar_upload_id:
          props.selected = "gravatar";
          break;
        default:
          props.selected = "uploaded";
      }

      controller.setProperties(props);
    },

    saveAvatarSelection: function() {
      var user = this.modelFor('user');
      var avatarSelector = this.controllerFor('avatar-selector');

      // sends the information to the server if it has changed
      if (avatarSelector.get('selectedUploadId') !== user.get('uploaded_avatar_id')) {
        user.pickAvatar(avatarSelector.get('selectedUploadId'))
          .then(function(){
            user.setProperties(avatarSelector.getProperties(
              'system_avatar_upload_id',
              'gravatar_avatar_upload_id',
              'custom_avatar_upload_id'
            ));
          });
      }

      // saves the data back
      avatarSelector.send('closeModal');
    },

  }
});
