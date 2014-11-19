import ObjectController from 'discourse/controllers/object';

// This controller supports the admin menu on topics
export default ObjectController.extend({
  menuVisible: false,
  showRecover: Em.computed.and('deleted', 'details.can_recover'),

  actions: {
    show: function() { this.set('menuVisible', true); },
    hide: function() { this.set('menuVisible', false); }
  }

});
