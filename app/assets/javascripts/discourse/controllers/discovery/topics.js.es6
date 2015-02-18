import DiscoveryController from 'discourse/controllers/discovery';
import { queryParams } from 'discourse/controllers/discovery-sortable';

var controllerOpts = {
  needs: ['discovery'],
  bulkSelectEnabled: false,
  selected: [],
  period: null,

  canStar: Em.computed.alias('controllers.discovery/topics.currentUser.id'),
  showTopicPostBadges: Em.computed.not('controllers.discovery/topics.new'),

  redirectedReason: Em.computed.alias('currentUser.redirected_to_top_reason'),

  order: 'default',
  ascending: false,

  actions: {

    changeSort: function(sortBy) {
      if (sortBy === this.get('order')) {
        this.toggleProperty('ascending');
      } else {
        this.setProperties({ order: sortBy, ascending: false });
      }
      this.get('model').refreshSort(sortBy, this.get('ascending'));
    },

    // Show newly inserted topics
    showInserted: function() {
      var tracker = Discourse.TopicTrackingState.current();

      // Move inserted into topics
      this.get('content').loadBefore(tracker.get('newIncoming'));
      tracker.resetTracking();
      return false;
    },

    refresh: function() {
      var filter = this.get('model.filter'),
          self = this;

      this.setProperties({ order: 'default', ascending: false });

      // Don't refresh if we're still loading
      if (this.get('controllers.discovery.loading')) { return; }

      // If we `send('loading')` here, due to returning true it bubbles up to the
      // router and ember throws an error due to missing `handlerInfos`.
      // Lesson learned: Don't call `loading` yourself.
      this.set('controllers.discovery.loading', true);
      Discourse.TopicList.find(filter).then(function(list) {
        Discourse.TopicList.hideUniformCategory(list, self.get('category'));

        self.setProperties({ model: list, selected: [] });

        var tracking = Discourse.TopicTrackingState.current();
        if (tracking) {
          tracking.sync(list, filter);
        }

        self.send('loadingComplete');
      });
    },

    toggleBulkSelect: function() {
      this.toggleProperty('bulkSelectEnabled');
      this.get('selected').clear();
    },

    resetNew: function() {
      var self = this;

      Discourse.TopicTrackingState.current().resetNew();
      Discourse.Topic.resetNew().then(function() {
        self.send('refresh');
      });
    },

    dismissRead: function(operationType) {
      var self = this,
          selected = this.get('selected'),
          operation;

      if(operationType === "posts"){
        operation = { type: 'dismiss_posts' };
      } else {
        operation = { type: 'change_notification_level',
                        notification_level_id: Discourse.Topic.NotificationLevel.REGULAR };
      }

      var promise;
      if (selected.length > 0) {
        promise = Discourse.Topic.bulkOperation(selected, operation);
      } else {
        promise = Discourse.Topic.bulkOperationByFilter('unread', operation, this.get('category.id'));
      }
      promise.then(function(result) {
        if (result && result.topic_ids) {
          var tracker = Discourse.TopicTrackingState.current();
          result.topic_ids.forEach(function(t) {
            tracker.removeTopic(t);
          });
          tracker.incrementMessageCount();
        }
        self.send('refresh');
      });
    }
  },


  topicTrackingState: function() {
    return Discourse.TopicTrackingState.current();
  }.property(),

  isFilterPage: function(filter, filterType) {
    return filter.match(new RegExp(filterType + '$', 'gi')) ? true : false;
  },

  showDismissRead: function() {
    return this.isFilterPage(this.get('filter'), 'unread') && this.get('topics.length') > 0;
  }.property('filter', 'topics.length'),

  showResetNew: function() {
    return this.get('filter') === 'new' && this.get('topics.length') > 0;
  }.property('filter', 'topics.length'),

  showDismissAtTop: function() {
    return (this.isFilterPage(this.get('filter'), 'new') ||
           this.isFilterPage(this.get('filter'), 'unread')) &&
           this.get('topics.length') >= 30;
  }.property('filter', 'topics.length'),

  canBulkSelect: Em.computed.alias('currentUser.staff'),
  hasTopics: Em.computed.gt('topics.length', 0),
  allLoaded: Em.computed.empty('more_topics_url'),
  latest: Discourse.computed.endWith('filter', 'latest'),
  new: Discourse.computed.endWith('filter', 'new'),
  top: Em.computed.notEmpty('period'),
  yearly: Em.computed.equal('period', 'yearly'),
  monthly: Em.computed.equal('period', 'monthly'),
  weekly: Em.computed.equal('period', 'weekly'),
  daily: Em.computed.equal('period', 'daily'),

  footerMessage: function() {
    if (!this.get('allLoaded')) { return; }

    var category = this.get('category');
    if( category ) {
      return I18n.t('topics.bottom.category', {category: category.get('name')});
    } else {
      var split = this.get('filter').split('/');
      if (this.get('topics.length') === 0) {
        return I18n.t("topics.none." + split[0], {
          category: split[1]
        });
      } else {
        return I18n.t("topics.bottom." + split[0], {
          category: split[1]
        });
      }
    }
  }.property('allLoaded', 'topics.length'),

  footerEducation: function() {
    if (!this.get('allLoaded') || this.get('topics.length') > 0 || !Discourse.User.current()) { return; }

    var split = this.get('filter').split('/');

    if (split[0] !== 'new' && split[0] !== 'unread') { return; }

    return I18n.t("topics.none.educate." + split[0], {
      userPrefsUrl: Discourse.getURL("/users/") + (Discourse.User.currentProp("username_lower")) + "/preferences"
    });
  }.property('allLoaded', 'topics.length'),

  loadMoreTopics() {
    return this.get('model').loadMore();
  }
};

Ember.keys(queryParams).forEach(function(p) {
  // If we don't have a default value, initialize it to null
  if (typeof controllerOpts[p] === 'undefined') {
    controllerOpts[p] = null;
  }
});

export default DiscoveryController.extend(controllerOpts);
