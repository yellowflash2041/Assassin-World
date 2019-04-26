import computed from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  tagName: "a",
  classNameBindings: [":discourse-tag", "style", "tagClass"],
  attributeBindings: ["href"],

  @computed("tagRecord.id")
  tagClass(tagRecordId) {
    return "tag-" + tagRecordId;
  },

  @computed("tagRecord.id")
  href(tagRecordId) {
    return Discourse.getURL("/tags/" + tagRecordId);
  }
});
