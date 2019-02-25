import { default as computed } from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  // subclasses need this
  layoutName: "components/d-button",

  form: null,

  tagName: "button",
  classNameBindings: [":btn", "noText", "btnType"],
  attributeBindings: [
    "form",
    "disabled",
    "translatedTitle:title",
    "translatedLabel:aria-label",
    "tabindex"
  ],

  btnIcon: Ember.computed.notEmpty("icon"),

  @computed("icon", "translatedLabel")
  btnType(icon, translatedLabel) {
    if (icon) {
      return translatedLabel ? "btn-icon-text" : "btn-icon";
    } else if (translatedLabel) {
      return "btn-text";
    }
  },

  noText: Ember.computed.empty("translatedLabel"),

  @computed("title")
  translatedTitle(title) {
    if (title) return I18n.t(title);
  },

  @computed("label")
  translatedLabel(label) {
    if (label) return I18n.t(label);
  },

  click() {
    if (typeof this.get("action") === "string") {
      this.sendAction("action", this.get("actionParam"));
    } else if (
      typeof this.get("action") === "object" &&
      this.get("action").value
    ) {
      this.get("action").value(this.get("actionParam"));
    } else if (typeof this.get("action") === "function") {
      this.get("action")(this.get("actionParam"));
    }

    return false;
  }
});
