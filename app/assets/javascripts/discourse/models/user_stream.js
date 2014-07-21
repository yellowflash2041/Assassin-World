/**
  Represents a user's stream

  @class UserStream
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/
Discourse.UserStream = Discourse.Model.extend({
  loaded: false,

  _initialize: function() {
    this.setProperties({
      itemsLoaded: 0,
      content: []
    });
  }.on("init"),

  filterParam: function() {
    var filter = this.get('filter');
    if (filter === Discourse.UserAction.TYPES.replies) {
      return [Discourse.UserAction.TYPES.replies,
              Discourse.UserAction.TYPES.mentions,
              Discourse.UserAction.TYPES.quotes].join(",");
    }
    return filter;
  }.property('filter'),

  baseUrl: Discourse.computed.url('itemsLoaded', 'user.username_lower', '/user_actions.json?offset=%@&username=%@'),

  filterBy: function(filter) {
    if (this.get('loaded') && (this.get('filter') === filter)) { return Ember.RSVP.resolve(); }

    this.setProperties({
      filter: filter,
      itemsLoaded: 0,
      content: []
    });

    return this.findItems();
  },

  remove: function(userAction) {
    // 1) remove the user action from the child groups
    this.get("content").forEach(function (ua) {
      ["likes", "stars", "edits", "bookmarks"].forEach(function (group) {
        var items = ua.get("childGroups." + group + ".items");
        if (items) {
          items.removeObject(userAction);
        }
      });
    });

    // 2) remove the parents that have no children
    var content = this.get("content").filter(function (ua) {
      return ["likes", "stars", "edits", "bookmarks"].any(function (group) {
        return ua.get("childGroups." + group + ".items.length") > 0;
      });
    });

    this.setProperties({
      content: content,
      itemsLoaded: content.length
    });
  },

  findItems: function() {
    var self = this;

    var url = this.get('baseUrl');
    if (this.get('filterParam')) {
      url += "&filter=" + this.get('filterParam');
    }

    // Don't load the same stream twice. We're probably at the end.
    var lastLoadedUrl = this.get('lastLoadedUrl');
    if (lastLoadedUrl === url) { return Ember.RSVP.resolve(); }

    if (this.get('loading')) { return Ember.RSVP.resolve(); }
    this.set('loading', true);
    return Discourse.ajax(url, {cache: 'false'}).then( function(result) {
      if (result && result.user_actions) {
        var copy = Em.A();
        result.user_actions.forEach(function(action) {
          copy.pushObject(Discourse.UserAction.create(action));
        });

        self.get('content').pushObjects(Discourse.UserAction.collapseStream(copy));
        self.setProperties({
          loaded: true,
          itemsLoaded: self.get('itemsLoaded') + result.user_actions.length
        });
      }
    }).finally(function() {
      self.set('loading', false);
      self.set('lastLoadedUrl', url);
    });
  }

});
