import { ajax } from 'discourse/lib/ajax';
import { default as computed, observes } from 'ember-addons/ember-computed-decorators';

export default Ember.ArrayController.extend({
  needs: ['application'],

  @observes('model.canLoadMore')
  _showFooter() {
    this.set("controllers.application.showFooter", !this.get("model.canLoadMore"));
  },

  @computed('model.content.length')
  hasNotifications(length) {
    return length > 0;
  },

  currentPath: Em.computed.alias('controllers.application.currentPath'),

  actions: {
    resetNew() {
      ajax('/notifications/mark-read', { method: 'PUT' }).then(() => {
        this.setEach('read', true);
      });
    },

    loadMore() {
      this.get('model').loadMore();
    }
  }
});
