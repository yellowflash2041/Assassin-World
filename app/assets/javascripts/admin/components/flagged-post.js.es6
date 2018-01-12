import showModal from 'discourse/lib/show-modal';
import computed from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  adminTools: Ember.inject.service(),
  expanded: false,
  suspended: false,

  tagName: 'div',
  classNameBindings: [
    ':flagged-post',
    'flaggedPost.hidden:hidden-post',
    'flaggedPost.deleted'
  ],

  canAct: Ember.computed.alias('actableFilter'),

  @computed('filter')
  actableFilter(filter) {
    return filter === 'active';
  },

  removeAfter(promise) {
    return promise.then(() => {
      this.attrs.removePost();
    }).catch(error => {
      if (error._discourse_displayed) { return; }
      bootbox.alert(I18n.t("admin.flags.error"));
    });
  },

  _spawnModal(name, model, modalClass) {
    let controller = showModal(name, { model, admin: true, modalClass });
    controller.removeAfter = (p) => this.removeAfter(p);
  },

  actions: {
    removeAfter(promise) {
      this.removeAfter(promise);
    },

    disagree() {
      this.removeAfter(this.get('flaggedPost').disagreeFlags());
    },

    defer() {
      this.removeAfter(this.get('flaggedPost').deferFlags());
    },

    expand() {
      this.get('flaggedPost').expandHidden().then(() => {
        this.set('expanded', true);
      });
    },

    showModerationHistory() {
      this.get('adminTools').showModerationHistory({
        filter: 'post',
        post_id: this.get('flaggedPost.id')
      });
    },

    showSuspendModal() {
      let post = this.get('flaggedPost');
      let user = post.get('user');
      this.get('adminTools').showSuspendModal(
        user,
        {
          post,
          successCallback: result => this.set('suspended', result.suspended)
        }
      );
    }
  }
});
