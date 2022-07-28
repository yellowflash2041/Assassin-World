import Component from "@ember/component";
import { schedule } from "@ember/runloop";
import tippy from "tippy.js";

export default class DiscourseTooltip extends Component {
  tagName = "";

  didInsertElement() {
    this._super(...arguments);
    this._initTippy();
  }

  willDestroyElement() {
    this._super(...arguments);
    this._tippyInstance.destroy();
  }

  _initTippy() {
    schedule("afterRender", () => {
      // Ember.ViewUtils.getViewBounds is a private API,
      // but it's not going to be dropped without a public deprecation warning,
      // see: https://stackoverflow.com/a/50125938/3206146
      // eslint-disable-next-line no-undef
      const viewBounds = Ember.ViewUtils.getViewBounds(this);
      const element = viewBounds.firstNode;
      const parent = viewBounds.parentElement;
      this._tippyInstance = tippy(parent, {
        content: element,
        theme: "d-tooltip",
        arrow: false,
        placement: "bottom-start",
      });
    });
  }
}
