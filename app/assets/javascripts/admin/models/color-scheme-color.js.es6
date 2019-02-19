import {
  default as computed,
  observes,
  on
} from "ember-addons/ember-computed-decorators";
import { propertyNotEqual, i18n } from "discourse/lib/computed";

const ColorSchemeColor = Discourse.Model.extend({
  @on("init")
  startTrackingChanges() {
    this.set("originals", { hex: this.get("hex") || "FFFFFF" });

    // force changed property to be recalculated
    this.notifyPropertyChange("hex");
  },

  // Whether value has changed since it was last saved.
  @computed("hex")
  changed(hex) {
    if (!this.get("originals")) return false;
    if (hex !== this.get("originals").hex) return true;

    return false;
  },

  // Whether the current value is different than Discourse's default color scheme.
  overridden: propertyNotEqual("hex", "default_hex"),

  // Whether the saved value is different than Discourse's default color scheme.
  @computed("default_hex", "hex")
  savedIsOverriden(defaultHex) {
    return this.get("originals").hex !== defaultHex;
  },

  revert() {
    this.set("hex", this.get("default_hex"));
  },

  undo() {
    if (this.get("originals")) {
      this.set("hex", this.get("originals").hex);
    }
  },

  translatedName: i18n("name", "admin.customize.colors.%@.name"),

  description: i18n("name", "admin.customize.colors.%@.description"),

  /**
    brightness returns a number between 0 (darkest) to 255 (brightest).
    Undefined if hex is not a valid color.

    @property brightness
  **/
  @computed("hex")
  brightness(hex) {
    if (hex.length === 6 || hex.length === 3) {
      if (hex.length === 3) {
        hex =
          hex.substr(0, 1) +
          hex.substr(0, 1) +
          hex.substr(1, 1) +
          hex.substr(1, 1) +
          hex.substr(2, 1) +
          hex.substr(2, 1);
      }
      return Math.round(
        (parseInt("0x" + hex.substr(0, 2)) * 299 +
          parseInt("0x" + hex.substr(2, 2)) * 587 +
          parseInt("0x" + hex.substr(4, 2)) * 114) /
          1000
      );
    }
  },

  @observes("hex")
  hexValueChanged() {
    if (this.get("hex")) {
      this.set(
        "hex",
        this.get("hex")
          .toString()
          .replace(/[^0-9a-fA-F]/g, "")
      );
    }
  },

  @computed("hex")
  valid(hex) {
    return hex.match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/) !== null;
  }
});

export default ColorSchemeColor;
