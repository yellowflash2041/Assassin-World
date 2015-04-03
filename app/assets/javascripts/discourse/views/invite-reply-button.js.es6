import ButtonView from 'discourse/views/button';

export default ButtonView.extend({
  textKey: 'topic.invite_reply.title',
  helpKey: 'topic.invite_reply.help',
  attributeBindings: ['disabled'],
  disabled: Em.computed.or('controller.archived', 'controller.closed', 'controller.deleted'),

  renderIcon(buffer) {
    buffer.push("<i class='fa fa-users'></i>");
  },

  click() {
    this.get('controller').send('showInvite');
  }
});
