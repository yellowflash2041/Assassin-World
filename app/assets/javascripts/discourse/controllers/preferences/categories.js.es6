import PreferencesTabController from "discourse/mixins/preferences-tab-controller";
import { popupAjaxError } from "discourse/lib/ajax-error";
import computed from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend(PreferencesTabController, {
  saveAttrNames: [
    "muted_category_ids",
    "watched_category_ids",
    "tracked_category_ids",
    "watched_first_post_category_ids"
  ],

  @computed(
    "model.watchedCategories",
    "model.watchedFirstPostCategories",
    "model.trackedCategories",
    "model.mutedCategories"
  )
  selectedCategories(watched, watchedFirst, tracked, muted) {
    return [].concat(watched, watchedFirst, tracked, muted).filter(t => t);
  },

  @computed
  canSee() {
    return this.get("currentUser.id") === this.get("model.id");
  },

  canSave: Ember.computed.or("canSee", "currentUser.admin"),

  actions: {
    save() {
      this.set("saved", false);
      return this.get("model")
        .save(this.get("saveAttrNames"))
        .then(() => {
          this.set("saved", true);
        })
        .catch(popupAjaxError);
    }
  }
});
