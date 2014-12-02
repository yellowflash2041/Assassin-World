// This controller handles actions related to a user's invitations
export default Ember.ObjectController.extend({
  user: null,
  model: null,
  totalInvites: null,
  canLoadMore: true,
  invitesLoading: false,

  init: function() {
    this._super();
    this.set('searchTerm', '');
  },

  uploadText: function() { return I18n.t("user.invited.bulk_invite.text"); }.property(),

  /**
    Observe the search term box with a debouncer and change the results.

    @observes searchTerm
  **/
  _searchTermChanged: Discourse.debounce(function() {
    var self = this;
    Discourse.Invite.findInvitedBy(self.get('user'), this.get('searchTerm')).then(function (invites) {
      self.set('model', invites);
    });
  }, 250).observes('searchTerm'),

  /**
    Can the currently logged in user invite users to the site

    @property canInviteToForum
  **/
  canInviteToForum: function() {
    return Discourse.User.currentProp('can_invite_to_forum');
  }.property(),

  /**
    Can the currently logged in user bulk invite users to the site (only Admin is allowed to perform this operation)

    @property canBulkInvite
  **/
  canBulkInvite: function() {
    return Discourse.User.currentProp('admin');
  }.property(),

  /**
    Should the search filter input box be displayed?

    @property showSearch
  **/
  showSearch: function() {
    return this.get('totalInvites') > 9;
  }.property('totalInvites'),

  actions: {

    /**
      Rescind a given invite

      @method rescive
      @param {Discourse.Invite} invite the invite to rescind.
    **/
    rescind: function(invite) {
      invite.rescind();
      return false;
    },

    /**
      Resend a given invite

      @method reinvite
      @param {Discourse.Invite} invite the invite to resend.
    **/
    reinvite: function(invite) {
      invite.reinvite();
      return false;
    },

    loadMore: function() {
      var self = this;
      var model = self.get('model');

      if (self.get('canLoadMore') && !self.get('invitesLoading')) {
        self.set('invitesLoading', true);
        Discourse.Invite.findInvitedBy(self.get('user'), self.get('searchTerm'), model.invites.length).then(function(invite_model) {
          self.set('invitesLoading', false);
          model.invites.pushObjects(invite_model.invites);
          if(invite_model.invites.length === 0 || invite_model.invites.length < Discourse.SiteSettings.invites_per_page) {
            self.set('canLoadMore', false);
          }
        });
      }
    }
  }

});
