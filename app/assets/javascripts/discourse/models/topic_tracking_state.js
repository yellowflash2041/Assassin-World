Discourse.TopicTrackingState = Discourse.Model.extend({
  messageCount: 0,

  init: function(){
    this._super();
    this.unreadSequence = [];
    this.newSequence = [];
    this.states = {};
  },

  establishChannels: function() {
    var tracker = this;

    var process = function(data){
      if (data.message_type === "delete") {
        tracker.removeTopic(data.topic_id);
        tracker.incrementMessageCount();
      }

      if (data.message_type === "new_topic" || data.message_type === "latest") {
        var ignored_categories = Discourse.User.currentProp("muted_category_ids");
        if(_.include(ignored_categories, data.payload.category_id)){
          return;
        }
      }

      if (data.message_type === "latest"){
        tracker.notify(data);
      }

      if (data.message_type === "new_topic" || data.message_type === "unread" || data.message_type === "read") {
        tracker.notify(data);
        var old = tracker.states["t" + data.topic_id];

        if(!_.isEqual(old, data.payload)){
          tracker.states["t" + data.topic_id] = data.payload;
          tracker.incrementMessageCount();
        }
      }
    };

    Discourse.MessageBus.subscribe("/new", process);
    Discourse.MessageBus.subscribe("/latest", process);
    var currentUser = Discourse.User.current();
    if(currentUser) {
      Discourse.MessageBus.subscribe("/unread/" + currentUser.id, process);
    }
  },

  updateSeen: function(topicId, highestSeen) {
    if(!topicId || !highestSeen) { return; }
    var state = this.states["t" + topicId];
    if(state && (!state.last_read_post_number || state.last_read_post_number < highestSeen)) {
      state.last_read_post_number = highestSeen;
      this.incrementMessageCount();
    }
  },

  notify: function(data){
    if (!this.newIncoming) { return; }

    if ((this.filter === "all" ||this.filter === "latest" || this.filter === "new") && data.message_type === "new_topic" ) {
      this.addIncoming(data.topic_id);
    }

    if ((this.filter === "all" || this.filter === "unread") && data.message_type === "unread") {
      var old = this.states["t" + data.topic_id];
      if(!old || old.highest_post_number === old.last_read_post_number) {
        this.addIncoming(data.topic_id);
      }
    }

    if(this.filter === "latest" && data.message_type === "latest") {
      this.addIncoming(data.topic_id);
    }

    this.set("incomingCount", this.newIncoming.length);
  },

  addIncoming: function(topicId) {
    if(this.newIncoming.indexOf(topicId) === -1){
      this.newIncoming.push(topicId);
    }
  },

  resetTracking: function(){
    this.newIncoming = [];
    this.set("incomingCount", 0);
  },

  // track how many new topics came for this filter
  trackIncoming: function(filter) {
    this.newIncoming = [];
    this.filter = filter;
    this.set("incomingCount", 0);
  },

  hasIncoming: function(){
    var count = this.get('incomingCount');
    return count && count > 0;
  }.property('incomingCount'),

  removeTopic: function(topic_id) {
    delete this.states["t" + topic_id];
  },

  sync: function(list, filter){
    var tracker = this;
    var states = this.states;

    if(!list || !list.topics) { return; }

    // compensate for delayed "new" topics
    // client side we know they are not new, server side we think they are
    for(var i=list.topics.length-1; i>=0; i--){
      var state = states["t"+ list.topics[i].id];
      if(state && state.last_read_post_number > 0){
        if(filter === "new"){
          list.topics.splice(i, 1);
        } else {
          list.topics[i].unseen = false;
          list.topics[i].dont_sync = true;
        }
      }
    }

    _.each(list.topics, function(topic){
      var row = tracker.states["t" + topic.id] || {};

      row.topic_id = topic.id;
      if(topic.unseen) {
        row.last_read_post_number = null;
      } else if (topic.unread || topic.new_posts){
        row.last_read_post_number = topic.highest_post_number - ((topic.unread||0) + (topic.new_posts||0));
      } else {
        if(!topic.dont_sync) {
          delete tracker.states["t" + topic.id];
        }
        return;
      }

      row.highest_post_number = topic.highest_post_number;
      if (topic.category) {
        row.category_id = topic.category.id;
      }

      tracker.states["t" + topic.id] = row;
    });

    this.incrementMessageCount();
  },

  incrementMessageCount: function() {
    this.set("messageCount", this.get("messageCount") + 1);
  },

  countNew: function(category_id){
    return _.chain(this.states)
      .where({last_read_post_number: null})
      .where(function(topic) {
        // !0 is true
        return (topic.notification_level !== 0 && !topic.notification_level) ||
               topic.notification_level >= Discourse.Topic.NotificationLevel.TRACKING;
      })
      .where(function(topic){ return topic.category_id === category_id || !category_id;})
      .value()
      .length;
  },

  resetNew: function() {
    var self = this;
    Object.keys(this.states).forEach(function (id) {
      if (self.states[id].last_read_post_number === null) {
        delete self.states[id];
      }
    });
  },

  countUnread: function(category_id){
    return _.chain(this.states)
      .where(function(topic){
        return topic.last_read_post_number !== null &&
               topic.last_read_post_number < topic.highest_post_number;
      })
      .where(function(topic) { return topic.notification_level >= Discourse.Topic.NotificationLevel.TRACKING})
      .where(function(topic){ return topic.category_id === category_id || !category_id;})
      .value()
      .length;
  },

  countCategory: function(category_id) {
    var count = 0;
    _.each(this.states, function(topic){
      if (topic.category_id === category_id) {
        count += (topic.last_read_post_number === null ||
                  topic.last_read_post_number < topic.highest_post_number) ? 1 : 0;
      }
    });
    return count;
  },

  lookupCount: function(name, category){
    var categoryName = category ? Em.get(category, "name") : null;
    if(name === "new") {
      return this.countNew(categoryName);
    } else if(name === "unread") {
      return this.countUnread(categoryName);
    } else {
      categoryName = name.split("/")[1];
      if(categoryName) {
        return this.countCategory(categoryName);
      }
    }
  },
  loadStates: function (data) {
    // not exposed
    var states = this.states;

    if(data) {
      _.each(data,function(topic){
        states["t" + topic.topic_id] = topic;
      });
    }
  }
});


Discourse.TopicTrackingState.reopenClass({
  createFromStates: function(data){
    var instance = Discourse.TopicTrackingState.create();
    instance.loadStates(data);
    instance.establishChannels();
    return instance;
  },
  current: function(){
    if (!this.tracker) {
      var data = PreloadStore.get('topicTrackingStates');
      this.tracker = this.createFromStates(data);
      PreloadStore.remove('topicTrackingStates');
    }
    return this.tracker;
  }
});
