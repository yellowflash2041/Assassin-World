import { exportUserArchive } from 'discourse/lib/export-csv';
import CanCheckEmails from 'discourse/mixins/can-check-emails';
import computed from 'ember-addons/ember-computed-decorators';

export default Ember.Controller.extend(CanCheckEmails, {
  indexStream: false,
  pmView: false,
  userActionType: null,
  needs: ['user-notifications', 'user-topics-list'],

  viewingSelf: function() {
    return this.get('content.username') === Discourse.User.currentProp('username');
  }.property('content.username'),

  @computed('indexStream', 'viewingSelf', 'forceExpand')
  collapsedInfo(indexStream, viewingSelf, forceExpand){
    return (!indexStream || viewingSelf) && !forceExpand;
  },

  linkWebsite: Em.computed.not('model.isBasic'),

  removeNoFollow: function() {
    return this.get('model.trust_level') > 2 && !this.siteSettings.tl3_links_no_follow;
  }.property('model.trust_level'),

  @computed('viewSelf', 'currentUser.admin')
  canSeePrivateMessages(viewingSelf, isAdmin) {
    return this.siteSettings.enable_private_messages && (viewingSelf || isAdmin);
  },

  canSeeNotificationHistory: Em.computed.alias('canSeePrivateMessages'),

  showBadges: function() {
    return Discourse.SiteSettings.enable_badges && (this.get('content.badge_count') > 0);
  }.property('content.badge_count'),

  privateMessageView: function() {
    return (this.get('userActionType') === Discourse.UserAction.TYPES.messages_sent) ||
           (this.get('userActionType') === Discourse.UserAction.TYPES.messages_received);
  }.property('userActionType'),

  canInviteToForum: function() {
    return Discourse.User.currentProp('can_invite_to_forum');
  }.property(),

  canDeleteUser: function() {
    return this.get('model.can_be_deleted') && this.get('model.can_delete_all_posts');
  }.property('model.can_be_deleted', 'model.can_delete_all_posts'),

  publicUserFields: function() {
    const siteUserFields = this.site.get('user_fields');
    if (!Ember.isEmpty(siteUserFields)) {
      const userFields = this.get('model.user_fields');
      return siteUserFields.filterProperty('show_on_profile', true).sortBy('position').map(field => {
        const value = userFields ? userFields[field.get('id').toString()] : null;
        return Ember.isEmpty(value) ? null : Ember.Object.create({ value, field });
      }).compact();
    }
  }.property('model.user_fields.@each.value'),

  privateMessagesActive: Em.computed.equal('pmView', 'index'),
  privateMessagesMineActive: Em.computed.equal('pmView', 'mine'),
  privateMessagesUnreadActive: Em.computed.equal('pmView', 'unread'),

  actions: {
    expandProfile: function() {
      this.set('forceExpand', true);
    },
    adminDelete: function() {
      Discourse.AdminUser.find(this.get('model.username').toLowerCase()).then(function(user){
        user.destroy({deletePosts: true});
      });
    },

    exportUserArchive: function() {
      bootbox.confirm(
        I18n.t("admin.export_csv.user_archive_confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            exportUserArchive();
          }
        }
      );
    }
  }
});
