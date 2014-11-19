import ModalFunctionality from 'discourse/mixins/modal-functionality';
import DiscourseController from 'discourse/controllers/controller';

export default DiscourseController.extend(ModalFunctionality, {
  emailSent: false,

  actions: {
    sendActivationEmail: function() {
      Discourse.ajax('/users/action/send_activation_email', {data: {username: this.get('username')}, type: 'POST'});
      this.set('emailSent', true);
    }
  }

});
