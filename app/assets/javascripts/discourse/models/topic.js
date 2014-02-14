/**
  A data model representing a Topic

  @class Topic
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/
Discourse.Topic = Discourse.Model.extend({

  postStream: function() {
    return Discourse.PostStream.create({topic: this});
  }.property(),

  details: function() {
    return Discourse.TopicDetails.create({topic: this});
  }.property(),

  invisible: Em.computed.not('visible'),
  deleted: Em.computed.notEmpty('deleted_at'),

  canConvertToRegular: function() {
    var a = this.get('archetype');
    return a !== 'regular' && a !== 'private_message';
  }.property('archetype'),

  convertArchetype: function() {
    var a = this.get('archetype');
    if (a !== 'regular' && a !== 'private_message') {
      this.set('archetype', 'regular');
      return Discourse.ajax(this.get('url'), {
        type: 'PUT',
        data: {archetype: 'regular'}
      });
    }
  },

  searchContext: function() {
    return ({ type: 'topic', id: this.get('id') });
  }.property('id'),

  category: function() {
    var categoryId = this.get('category_id');
    if (categoryId) {
      return Discourse.Category.list().findProperty('id', categoryId);
    }

    var categoryName = this.get('categoryName');
    if (categoryName) {
      return Discourse.Category.list().findProperty('name', categoryName);
    }
    return null;
  }.property('category_id', 'categoryName'),

  shareUrl: function(){
    var user = Discourse.User.current();
    return this.get('url') + (user ? '?u=' + user.get('username_lower') : '');
  }.property('url'),

  url: function() {
    var slug = this.get('slug');
    if (slug.trim().length === 0) {
      slug = "topic";
    }
    return Discourse.getURL("/t/") + slug + "/" + (this.get('id'));
  }.property('id', 'slug'),

  // Helper to build a Url with a post number
  urlForPostNumber: function(postNumber) {
    var url = this.get('url');
    if (postNumber && (postNumber > 1)) {
      if (postNumber >= this.get('highest_post_number')) {
        url += "/last";
      } else {
        url += "/" + postNumber;
      }
    }
    return url;
  },

  lastReadUrl: function() {
    return this.urlForPostNumber(this.get('last_read_post_number'));
  }.property('url', 'last_read_post_number'),

  lastUnreadUrl: function() {
    var postNumber = Math.min(this.get('last_read_post_number') + 1, this.get('highest_post_number'));
    return this.urlForPostNumber(postNumber);
  }.property('url', 'last_read_post_number', 'highest_post_number'),

  lastPostUrl: function() {
    return this.urlForPostNumber(this.get('highest_post_number'));
  }.property('url', 'highest_post_number'),

  lastPosterUrl: function() {
    return Discourse.getURL("/users/") + this.get("last_poster.username");
  }.property('last_poster'),

  // The amount of new posts to display. It might be different than what the server
  // tells us if we are still asynchronously flushing our "recently read" data.
  // So take what the browser has seen into consideration.
  displayNewPosts: function() {
    var delta, result;
    var highestSeen = Discourse.Session.currentProp('highestSeenByTopic')[this.get('id')];
    if (highestSeen) {
      delta = highestSeen - this.get('last_read_post_number');
      if (delta > 0) {
        result = this.get('new_posts') - delta;
        if (result < 0) {
          result = 0;
        }
        return result;
      }
    }
    return this.get('new_posts');
  }.property('new_posts', 'id'),

  // The coldmap class for the age of the topic
  ageCold: function() {
    var createdAt, daysSinceEpoch, lastPost, lastPostDays, nowDays;
    if (!(createdAt = this.get('created_at'))) return;
    if (!(lastPost = this.get('last_posted_at'))) lastPost = createdAt;
    daysSinceEpoch = function(dt) {
      // 1000 * 60 * 60 * 24 = days since epoch
      return dt.getTime() / 86400000;
    };

    // Show heat on age
    nowDays = daysSinceEpoch(new Date());
    lastPostDays = daysSinceEpoch(new Date(lastPost));
    if (nowDays - lastPostDays > 60) return 'coldmap-high';
    if (nowDays - lastPostDays > 30) return 'coldmap-med';
    if (nowDays - lastPostDays > 14) return 'coldmap-low';
    return null;
  }.property('age', 'created_at', 'last_posted_at'),

  viewsHeat: function() {
    var v = this.get('views');
    if( v >= Discourse.SiteSettings.topic_views_heat_high )   return 'heatmap-high';
    if( v >= Discourse.SiteSettings.topic_views_heat_medium ) return 'heatmap-med';
    if( v >= Discourse.SiteSettings.topic_views_heat_low )    return 'heatmap-low';
    return null;
  }.property('views'),

  archetypeObject: function() {
    return Discourse.Site.currentProp('archetypes').findProperty('id', this.get('archetype'));
  }.property('archetype'),
  isPrivateMessage: Em.computed.equal('archetype', 'private_message'),

  toggleStatus: function(property) {
    this.toggleProperty(property);
    if (property === 'closed' && this.get('closed')) {
      this.set('details.auto_close_at', null);
    }
    return Discourse.ajax(this.get('url') + "/status", {
      type: 'PUT',
      data: {status: property, enabled: this.get(property) ? 'true' : 'false' }
    });
  },

  starTooltipKey: function() {
    return this.get('starred') ? 'starred.help.unstar' : 'starred.help.star';
  }.property('starred'),

  starTooltip: function() {
    return I18n.t(this.get('starTooltipKey'));
  }.property('starTooltipKey'),

  estimatedReadingTime: function() {
    var wordCount = this.get('word_count');
    if (!wordCount) return;

    // Avg for 500 words per minute when you account for skimming
    var minutes = Math.floor(wordCount / 500.0);
    return minutes;
  }.property('word_count'),

  toggleStar: function() {
    var topic = this;
    topic.toggleProperty('starred');
    return Discourse.ajax({
      url: "" + (this.get('url')) + "/star",
      type: 'PUT',
      data: { starred: topic.get('starred') ? true : false }
    }).then(null, function (error) {
      topic.toggleProperty('starred');

      if (error && error.responseText) {
        bootbox.alert($.parseJSON(error.responseText).errors);
      } else {
        bootbox.alert(I18n.t('generic_error'));
      }
    });
  },

  // Save any changes we've made to the model
  save: function() {
    // Don't save unless we can
    if (!this.get('details.can_edit')) return;

    return Discourse.ajax(this.get('url'), {
      type: 'PUT',
      data: { title: this.get('title'), category: this.get('category.name') }
    });
  },

  // Reset our read data for this topic
  resetRead: function() {
    return Discourse.ajax("/t/" + this.get('id') + "/timings", {
      type: 'DELETE'
    });
  },

  /**
    Invite a user to this topic

    @method createInvite
    @param {String} emailOrUsername The email or username of the user to be invited
  **/
  createInvite: function(emailOrUsername) {
    return Discourse.ajax("/t/" + this.get('id') + "/invite", {
      type: 'POST',
      data: { user: emailOrUsername }
    });
  },

  // Delete this topic
  destroy: function(deleted_by) {
    this.setProperties({
      deleted_at: new Date(),
      deleted_by: deleted_by,
      'details.can_delete': false,
      'details.can_recover': true
    });
    return Discourse.ajax("/t/" + this.get('id'), { type: 'DELETE' });
  },

  // Recover this topic if deleted
  recover: function() {
    this.setProperties({
      deleted_at: null,
      deleted_by: null,
      'details.can_delete': true,
      'details.can_recover': false
    });
    return Discourse.ajax("/t/" + this.get('id') + "/recover", { type: 'PUT' });
  },

  // Update our attributes from a JSON result
  updateFromJson: function(json) {
    this.get('details').updateFromJson(json.details);

    var keys = Object.keys(json);
    keys.removeObject('details');
    keys.removeObject('post_stream');

    var topic = this;
    keys.forEach(function (key) {
      topic.set(key, json[key]);
    });

  },

  isPinnedUncategorized: function() {
    return this.get('pinned') && this.get('category.isUncategorizedCategory');
  }.property('pinned', 'category.isUncategorizedCategory'),

  /**
    Clears the pin from a topic for the currently logged in user

    @method clearPin
  **/
  clearPin: function() {
    var topic = this;

    // Clear the pin optimistically from the object
    topic.set('pinned', false);

    Discourse.ajax("/t/" + this.get('id') + "/clear-pin", {
      type: 'PUT'
    }).then(null, function() {
      // On error, put the pin back
      topic.set('pinned', true);
    });
  },

  // Is the reply to a post directly below it?
  isReplyDirectlyBelow: function(post) {
    var posts = this.get('postStream.posts');
    if (!posts) return;

    var postBelow = posts[posts.indexOf(post) + 1];

    // If the post directly below's reply_to_post_number is our post number, it's
    // considered directly below.
    return postBelow && postBelow.get('reply_to_post_number') === post.get('post_number');
  },

  excerptNotEmpty: Em.computed.notEmpty('excerpt'),
  hasExcerpt: Em.computed.and('pinned', 'excerptNotEmpty'),

  excerptTruncated: function() {
    var e = this.get('excerpt');
    return( e && e.substr(e.length - 8,8) === '&hellip;' );
  }.property('excerpt'),

  readLastPost: Discourse.computed.propertyEqual('last_read_post_number', 'highest_post_number'),
  canCleanPin: Em.computed.and('pinned', 'readLastPost')

});

Discourse.Topic.reopenClass({
  NotificationLevel: {
    WATCHING: 3,
    TRACKING: 2,
    REGULAR: 1,
    MUTED: 0
  },

  createActionSummary: function(result) {
    if (result.actions_summary) {
      var lookup = Em.Object.create();
      result.actions_summary = result.actions_summary.map(function(a) {
        a.post = result;
        a.actionType = Discourse.Site.current().postActionTypeById(a.id);
        var actionSummary = Discourse.ActionSummary.create(a);
        lookup.set(a.actionType.get('name_key'), actionSummary);
        return actionSummary;
      });
      result.set('actionByName', lookup);
    }
  },

  create: function() {
    var result = this._super.apply(this, arguments);
    this.createActionSummary(result);
    return result;
  },

  /**
    Find similar topics to a given title and body

    @method findSimilar
    @param {String} title The current title
    @param {String} body The current body
    @returns A promise that will resolve to the topics
  **/
  findSimilarTo: function(title, body) {
    return Discourse.ajax("/topics/similar_to", { data: {title: title, raw: body} }).then(function (results) {
      if (Array.isArray(results)) {
        return results.map(function(topic) { return Discourse.Topic.create(topic); });
      } else {
        return Ember.A();
      }
    });
  },

  // Load a topic, but accepts a set of filters
  find: function(topicId, opts) {
    var url = Discourse.getURL("/t/") + topicId;

    if (opts.nearPost) {
      url += "/" + opts.nearPost;
    }

    var data = {};
    if (opts.postsAfter) {
      data.posts_after = opts.postsAfter;
    }
    if (opts.postsBefore) {
      data.posts_before = opts.postsBefore;
    }
    if (opts.trackVisit) {
      data.track_visit = true;
    }

    // Add username filters if we have them
    if (opts.userFilters && opts.userFilters.length > 0) {
      data.username_filters = [];
      opts.userFilters.forEach(function(username) {
        data.username_filters.push(username);
      });
    }

    // Add the summary of filter if we have it
    if (opts.summary === true) {
      data.summary = true;
    }

    // Check the preload store. If not, load it via JSON
    return Discourse.ajax(url + ".json", {data: data});
  },

  mergeTopic: function(topicId, destinationTopicId) {
    var promise = Discourse.ajax("/t/" + topicId + "/merge-topic", {
      type: 'POST',
      data: {destination_topic_id: destinationTopicId}
    }).then(function (result) {
      if (result.success) return result;
      promise.reject(new Error("error merging topic"));
    });
    return promise;
  },

  movePosts: function(topicId, opts) {
    var promise = Discourse.ajax("/t/" + topicId + "/move-posts", {
      type: 'POST',
      data: opts
    }).then(function (result) {
      if (result.success) return result;
      promise.reject(new Error("error moving posts topic"));
    });
    return promise;
  },

  bulkOperation: function(topics, operation) {
    return Discourse.ajax("/topics/bulk", {
      type: 'PUT',
      data: {
        topic_ids: topics.map(function(t) { return t.get('id'); }),
        operation: operation
      }
    });
  }

});


