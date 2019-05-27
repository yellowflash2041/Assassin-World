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
    "tabindex",
    "type"
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
  translatedTitle: {
    get() {
      if (this._translatedTitle) return this._translatedTitle;
      if (this.title) return I18n.t(this.title);
    },
    set(value) {
      return (this._translatedTitle = value);
    }
  },

  @computed("label")
  translatedLabel: {
    get() {
      if (this._translatedLabel) return this._translatedLabel;
      if (this.label) return I18n.t(this.label);
    },
    set(value) {
      return (this._translatedLabel = value);
    }
  },

  click() {
    if (typeof this.action === "string") {
      this.sendAction("action", this.actionParam);
    } else if (typeof this.action === "object" && this.action.value) {
      this.action.value(this.actionParam);
    } else if (typeof this.action === "function") {
      this.action(this.actionParam);
    }

    return false;
  }
});
