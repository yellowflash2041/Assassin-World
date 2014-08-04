/**
  A modal view for agreeing with a flag.

  @class AdminAgreeFlagView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminAgreeFlagView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_agree_flag',
  title: I18n.t('admin.flags.agree_flag_modal_title')
});
