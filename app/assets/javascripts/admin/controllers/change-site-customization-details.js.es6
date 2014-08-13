import ModalFunctionality from 'discourse/mixins/modal-functionality';

import ObjectController from 'discourse/controllers/object';

export default ObjectController.extend(ModalFunctionality, {
  previousSelected: Ember.computed.equal('selectedTab', 'previous'),
  newSelected:      Ember.computed.equal('selectedTab', 'new'),

  onShow: function() {
    this.selectNew();
  },

  selectNew: function() {
    this.set('selectedTab', 'new');
  },

  selectPrevious: function() {
    this.set('selectedTab', 'previous');
  }
});
