import DiscourseController from 'discourse/controllers/controller';

const HeaderController = DiscourseController.extend({
  topic: null,
  showExtraInfo: null,
  notifications: null,
  loadingNotifications: false,
  needs: ['application'],

  loginRequired: Em.computed.alias('controllers.application.loginRequired'),
  canSignUp: Em.computed.alias('controllers.application.canSignUp'),

  showSignUpButton: function() {
    return this.get('canSignUp') && !this.get('showExtraInfo');
  }.property('canSignUp', 'showExtraInfo'),

  showStarButton: function() {
    return Discourse.User.current() && !this.get('topic.isPrivateMessage');
  }.property('topic.isPrivateMessage'),

  _resetCachedNotifications: function() {
    // a bit hacky, but if we have no focus, hide notifications first
    const visible = $("#notifications-dropdown").is(":visible");

    if(!Discourse.get("hasFocus")) {
      if(visible){
        $("html").click();
      }
      this.set("notifications", null);
      return;
    }
    if(visible){
      this.refreshNotifications();
    } else {
      this.set("notifications", null);
    }
  }.observes("currentUser.lastNotificationChange"),

  refreshNotifications: function(){
    const self = this;
    if (self.get("loadingNotifications")) { return; }

    self.set("loadingNotifications", true);
    Discourse.NotificationContainer.loadRecent().then(function(result) {
      self.setProperties({
        'currentUser.unread_notifications': 0,
        notifications: result
      });
    }).catch(function() {
      self.setProperties({
        notifications: null
      });
    }).finally(function() {
      self.set("loadingNotifications", false);
    });
  },

  actions: {
    toggleStar() {
      const topic = this.get('topic');
      if (topic) topic.toggleStar();
      return false;
    },

    showNotifications(headerView) {
      const self = this;

      if (self.get('currentUser.unread_notifications') || self.get('currentUser.unread_private_messages') || !self.get('notifications')) {
        self.refreshNotifications();
      }
      headerView.showDropdownBySelector("#user-notifications");
    }
  }
});

// Allow plugins to add to the sum of "flags" above the site map
const _flagProperties = [];
function addFlagProperty(prop) {
  _flagProperties.pushObject(prop);
}

let _appliedFlagProps = false;
HeaderController.reopenClass({
  create() {
    // We only want to change the class the first time it's created
    if (!_appliedFlagProps && _flagProperties.length) {
      _appliedFlagProps = true;

      const args = _flagProperties.slice();
      args.push(function() {
        let sum = 0;
        _flagProperties.forEach((fp) => sum += (this.get(fp) || 0));
        return sum;
      });
      HeaderController.reopen({ flaggedPostsCount: Ember.computed.apply(this, args) });
    }
    return this._super.apply(this, Array.prototype.slice.call(arguments));
  }
});

addFlagProperty('currentUser.site_flagged_posts_count');

export { addFlagProperty };
export default HeaderController;
