/**
  This route is used for retrieving a topic based on params

  @class TopicFromParamsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.TopicFromParamsRoute = Discourse.Route.extend({

  setupController: function(controller, params) {
    params = params || {};
    params.track_visit = true;

    var topic = this.modelFor('topic');
    var postStream = topic.get('postStream');

    var queryParams = Discourse.URL.get('queryParams');
    if (queryParams) {
      // Set bestOf on the postStream if present
      postStream.set('bestOf', Em.get(queryParams, 'filter') === 'best_of');

      // Set any username filters on the postStream
      var userFilters = Em.get(queryParams, 'username_filters[]');
      if (userFilters) {
        if (typeof userFilters === "string") { userFilters = [userFilters]; }
        userFilters.forEach(function (username) {
          postStream.get('userFilters').add(username);
        });
      }
    }

    var topicController = this.controllerFor('topic');
    postStream.refresh(params).then(function () {

      // The post we requested might not exist. Let's find the closest post
      var closest = postStream.closestPostNumberFor(params.nearPost) || 1;

      topicController.setProperties({
        currentPost: closest,
        progressPosition: closest
      });

      if (topic.present('draft')) {
        Discourse.openComposer({
          draft: Discourse.Draft.getLocal(topic.get('draft_key'), topic.get('draft')),
          draftKey: topic.get('draft_key'),
          draftSequence: topic.get('draft_sequence'),
          topic: topic,
          ignoreIfChanged: true
        });
      }
    });


  }

});


