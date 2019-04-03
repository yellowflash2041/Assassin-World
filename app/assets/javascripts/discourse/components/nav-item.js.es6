/* You might be looking for navigation-item. */
import { iconHTML } from "discourse-common/lib/icon-library";
import computed from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  tagName: "li",
  classNameBindings: ["active"],
  router: Ember.inject.service(),

  @computed("label", "i18nLabel", "icon")
  contents(label, i18nLabel, icon) {
    let text = i18nLabel || I18n.t(label);
    if (icon) {
      return `${iconHTML(icon)} ${text}`.htmlSafe();
    }
    return text;
  },

  @computed("route", "router.currentRoute")
  active(route, currentRoute) {
    if (!route) {
      return;
    }

    const routeParam = this.get("routeParam");
    if (routeParam && currentRoute) {
      return currentRoute.params["filter"] === routeParam;
    }

    return this.get("router").isActive(route);
  }
});
