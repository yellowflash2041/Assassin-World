/**
  This controller supports actions on the site header

  @class HeaderController
  @extends Discourse.Controller
  @namespace Discourse
  @module Discourse
**/
Discourse.HeaderController = Discourse.Controller.extend({
  topic: null,
  showExtraInfo: null,

  toggleStar: function() {
    var topic = this.get('topic');
    if (topic) topic.toggleStar();
    return false;
  },

  categories: function() {
    return Discourse.Category.list();
  }.property(),

  showFavoriteButton: function() {
    return Discourse.User.current() && !this.get('topic.isPrivateMessage');
  }.property('topic.isPrivateMessage'),

  mobileDevice: function() {
    return Discourse.Session.currentProp('mobileDevice');
  }.property(),

  mobileView: function() {
    return Discourse.Session.currentProp('mobileView');
  }.property(),

  toggleMobileView: function() {
    window.location.assign(window.location.pathname + '?mobile_view=' + (Discourse.Session.currentProp('mobileView') ? '0' : '1'));
  }

});


