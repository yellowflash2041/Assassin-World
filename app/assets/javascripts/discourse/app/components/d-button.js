import { empty, equal, notEmpty } from "@ember/object/computed";
import Component from "@ember/component";
import DiscourseURL from "discourse/lib/url";
import I18n from "I18n";
import { computed } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";

export default Component.extend({
  tagName: "button",
  // subclasses need this
  layoutName: "components/d-button",
  form: null,
  type: "button",
  title: null,
  translatedTitle: null,
  label: null,
  translatedLabel: null,
  ariaLabel: null,
  translatedAriaLabel: null,
  forwardEvent: false,

  isLoading: computed({
    set(key, value) {
      this.set("forceDisabled", value);
      return value;
    },
  }),

  classNameBindings: [
    "isLoading:is-loading",
    "btnLink::btn",
    "btnLink",
    "noText",
    "btnType",
  ],
  attributeBindings: [
    "form",
    "isDisabled:disabled",
    "computedTitle:title",
    "computedAriaLabel:aria-label",
    "tabindex",
    "type",
  ],

  isDisabled: computed("disabled", "forceDisabled", function () {
    return this.forceDisabled || this.disabled;
  }),

  forceDisabled: false,

  btnIcon: notEmpty("icon"),

  btnLink: equal("display", "link"),

  @discourseComputed("icon", "computedLabel")
  btnType(icon, translatedLabel) {
    if (icon) {
      return translatedLabel ? "btn-icon-text" : "btn-icon";
    } else if (translatedLabel) {
      return "btn-text";
    }
  },

  noText: empty("computedLabel"),

  @discourseComputed("title", "translatedTitle")
  computedTitle(title, translatedTitle) {
    if (this.title) {
      return I18n.t(title);
    }
    return translatedTitle;
  },

  @discourseComputed("label", "translatedLabel")
  computedLabel(label, translatedLabel) {
    if (this.label) {
      return I18n.t(label);
    }
    return translatedLabel;
  },

  @discourseComputed("ariaLabel", "translatedAriaLabel", "computedLabel")
  computedAriaLabel(ariaLabel, translatedAriaLabel, computedLabel) {
    if (ariaLabel) {
      return I18n.t(ariaLabel);
    }
    if (translatedAriaLabel) {
      return translatedAriaLabel;
    }
    return computedLabel;
  },

  click(event) {
    let { action } = this;

    if (action) {
      if (typeof action === "string") {
        // Note: This is deprecated in new Embers and needs to be removed in the future.
        // There is already a warning in the console.
        this.sendAction("action", this.actionParam);
      } else if (typeof action === "object" && action.value) {
        if (this.forwardEvent) {
          action.value(this.actionParam, event);
        } else {
          action.value(this.actionParam);
        }
      } else if (typeof this.action === "function") {
        if (this.forwardEvent) {
          action(this.actionParam, event);
        } else {
          action(this.actionParam);
        }
      }
    }

    if (this.href && this.href.length) {
      DiscourseURL.routeTo(this.href);
    }

    return false;
  },
});
