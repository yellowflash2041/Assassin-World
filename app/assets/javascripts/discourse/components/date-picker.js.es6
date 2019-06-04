/* global Pikaday:true */
import loadScript from "discourse/lib/load-script";
import {
  default as computed,
  on
} from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  classNames: ["date-picker-wrapper"],
  _picker: null,
  value: null,

  @computed("site.mobileView")
  inputType(mobileView) {
    return mobileView ? "date" : "text";
  },

  @on("didInsertElement")
  _loadDatePicker() {
    const container = this.element.querySelector(`#${this.containerId}`);

    if (this.site.mobileView) {
      this._loadNativePicker(container);
    } else {
      this._loadPikadayPicker(container);
    }
  },

  _loadPikadayPicker(container) {
    loadScript("/javascripts/pikaday.js").then(() => {
      Ember.run.next(() => {
        const default_opts = {
          field: this.element.querySelector(".date-picker"),
          container: container || this.element,
          bound: container === null,
          format: "YYYY-MM-DD",
          firstDay: 1,
          i18n: {
            previousMonth: I18n.t("dates.previous_month"),
            nextMonth: I18n.t("dates.next_month"),
            months: moment.months(),
            weekdays: moment.weekdays(),
            weekdaysShort: moment.weekdaysShort()
          },
          onSelect: date => this._handleSelection(date)
        };

        this._picker = new Pikaday(Object.assign(default_opts, this._opts()));
      });
    });
  },

  _loadNativePicker(container) {
    const wrapper = container || this.element;
    const picker = wrapper.querySelector("input.date-picker");
    picker.onchange = () => this._handleSelection(picker.value);
    picker.hide = () => {
      /* do nothing for native */
    };
    picker.destroy = () => {
      /* do nothing for native */
    };
    this._picker = picker;
  },

  _handleSelection(value) {
    const formattedDate = moment(value).format("YYYY-MM-DD");

    if (!this.element || this.isDestroying || this.isDestroyed) return;

    this._picker && this._picker.hide();

    if (this.onSelect) {
      this.onSelect(formattedDate);
    }
  },

  @on("willDestroyElement")
  _destroy() {
    if (this._picker) {
      this._picker.destroy();
    }
    this._picker = null;
  },

  @computed()
  placeholder() {
    return I18n.t("dates.placeholder");
  },

  _opts() {
    return null;
  }
});
