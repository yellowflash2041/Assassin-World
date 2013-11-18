/**
  This view handles rendering of the map of the topic under the first post

  @class TopicMapView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/
Discourse.TopicMapView = Discourse.ContainerView.extend({
  classNameBindings: ['hidden', ':topic-map'],
  shouldRerender: Discourse.View.renderIfChanged('topic.posts_count'),

  hidden: function() {
    if (!this.get('post.firstPost')) return true;

    var topic = this.get('topic');
    if (topic.get('archetype') === 'private_message') return false;
    if (topic.get('archetype') !== 'regular') return true;
    return topic.get('posts_count') < 2;
  }.property(),

  init: function() {
    this._super();
    if (this.get('hidden')) return;

    this.attachViewWithArgs({ topic: this.get('topic') }, Discourse.DiscourseTopicInformationComponent);
    this.trigger('appendMapInformation', this);
  },

  appendMapInformation: function(container) {
    var topic = this.get('topic');

    // If we have a best of capability
    if (topic.get('has_best_of')) {
      container.attachViewWithArgs({ topic: topic }, Discourse.DiscourseToggleBestOfComponent);
    }

    // If we have a private message
    if (this.get('topic.isPrivateMessage')) {
      container.attachViewWithArgs({ topic: topic, showPrivateInviteAction: 'showPrivateInvite' }, Discourse.DiscoursePrivateMessageMapComponent);
    }
  }
});

