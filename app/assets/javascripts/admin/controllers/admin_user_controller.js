/**
  A controller related to viewing a user in the admin section

  @class AdminUserIndexController
  @extends Discourse.ObjectController
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUserIndexController = Discourse.ObjectController.extend({
  editingTitle: false,
  originalPrimaryGroupId: null,
  availableGroups: null,

  showApproval: Discourse.computed.setting('must_approve_users'),
  showBadges: Discourse.computed.setting('enable_badges'),

  primaryGroupDirty: Discourse.computed.propertyNotEqual('originalPrimaryGroupId', 'primary_group_id'),

  custom_groups: Ember.computed.filter("model.groups", function(g){
    return (!g.automatic && g.visible);
  }),

  actions: {
    toggleTitleEdit: function() {
      this.toggleProperty('editingTitle');
    },

    saveTitle: function() {
      Discourse.ajax("/users/" + this.get('username').toLowerCase(), {
        data: {title: this.get('title')},
        type: 'PUT'
      }).then(null, function(e){
        bootbox.alert(I18n.t("generic_error_with_reason", {error: "http: " + e.status + " - " + e.body}));
      });

      this.send('toggleTitleEdit');
    },

    generateApiKey: function() {
      this.get('model').generateApiKey();
    },

    groupAdded: function(added){
      this.get('model').groupAdded(added).catch(function() {
        bootbox.alert(I18n.t('generic_error'));
      });
    },

    groupRemoved: function(removed){
      this.get('model').groupRemoved(removed).catch(function() {
        bootbox.alert(I18n.t('generic_error'));
      });
    },

    savePrimaryGroup: function() {
      var self = this;
      Discourse.ajax("/admin/users/" + this.get('id') + "/primary_group", {
        type: 'PUT',
        data: {primary_group_id: this.get('primary_group_id')}
      }).then(function () {
        self.set('originalPrimaryGroupId', self.get('primary_group_id'));
      }).catch(function() {
        bootbox.alert(I18n.t('generic_error'));
      });
    },

    resetPrimaryGroup: function() {
      this.set('primary_group_id', this.get('originalPrimaryGroupId'));
    },

    regenerateApiKey: function() {
      var self = this;
      bootbox.confirm(I18n.t("admin.api.confirm_regen"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          self.get('model').generateApiKey();
        }
      });
    },

    revokeApiKey: function() {
      var self = this;
      bootbox.confirm(I18n.t("admin.api.confirm_revoke"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          self.get('model').revokeApiKey();
        }
      });
    }
  }

});

