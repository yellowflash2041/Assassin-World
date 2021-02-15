import Component from "@ember/component";
import { bind } from "@ember/runloop";
import { computed } from "@ember/object";
import layout from "select-kit/templates/components/select-kit/select-kit-body";

export default Component.extend({
  layout,
  classNames: ["select-kit-body"],
  attributeBindings: ["role"],
  classNameBindings: ["emptyBody:empty-body"],
  emptyBody: computed("selectKit.{filter,hasNoContent}", function () {
    return !this.selectKit.filter && this.selectKit.hasNoContent;
  }),
  rootEventType: "click",

  role: "listbox",

  init() {
    this._super(...arguments);

    this.handleRootMouseDownHandler = bind(this, this.handleRootMouseDown);
  },

  didInsertElement() {
    this._super(...arguments);

    document.addEventListener(
      this.rootEventType,
      this.handleRootMouseDownHandler,
      true
    );
  },

  willDestroyElement() {
    this._super(...arguments);

    document.removeEventListener(
      this.rootEventType,
      this.handleRootMouseDownHandler,
      true
    );
  },

  handleRootMouseDown(event) {
    if (!this.selectKit.isExpanded) {
      return;
    }

    const headerElement = document.querySelector(
      `#${this.selectKit.uniqueID}-header`
    );

    if (headerElement && headerElement.contains(event.target)) {
      return;
    }

    if (this.element.contains(event.target)) {
      return;
    }

    this.selectKit.close(event);
  },
});
