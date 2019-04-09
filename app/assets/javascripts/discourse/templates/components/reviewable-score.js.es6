import computed from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  tagName: "",

  @computed("rs.score_type.title", "reviewable.target_created_by")
  title(title, targetCreatedBy) {
    if (title && targetCreatedBy) {
      return title.replace("{{username}}", targetCreatedBy.username);
    }

    return title;
  }
});
