import Component from "@ember/component";
import computed from "ember-addons/ember-computed-decorators";

export default Component.extend({
  classNames: ["google-search-form"],
  classNameBindings: ["hidden:hidden"],

  hidden: Ember.computed.alias("siteSettings.login_required"),

  @computed
  siteUrl() {
    return `${location.protocol}//${location.host}${Discourse.getURL("/")}`;
  }
});
