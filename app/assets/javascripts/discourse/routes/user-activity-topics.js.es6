import UserTopicListRoute from "discourse/routes/user-topic-list";

export default UserTopicListRoute.extend({
  userActionType: Discourse.UserAction.TYPES.topics,

  model: function() {
    return Discourse.TopicList.find('topics/created-by/' + this.modelFor('user').get('username_lower'));
  }
});
