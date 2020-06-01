import { scheduleOnce } from "@ember/runloop";
import DiscourseURL from "discourse/lib/url";
import { deprecated } from "discourse/mixins/scroll-top";
import Mixin from "@ember/object/mixin";
import { isTesting } from "discourse-common/config/environment";

const context = {
  _scrollTop() {
    if (isTesting()) {
      return;
    }
    $(document).scrollTop(0);
  }
};

function scrollTop() {
  if (DiscourseURL.isJumpScheduled()) {
    return;
  }
  scheduleOnce("afterRender", context, context._scrollTop);
}

export default Mixin.create({
  didInsertElement() {
    deprecated(
      "The `ScrollTop` mixin is deprecated. Replace it with a `{{d-section}}` component"
    );
    this._super(...arguments);
    scrollTop();
  }
});

export { scrollTop };
