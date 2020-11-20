import {
  discourseModule,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";

discourseModule("Integration | Component | d-icon", function (hooks) {
  setupRenderingTest(hooks);

  componentTest("default", {
    template: '<div class="test">{{d-icon "bars"}}</div>',

    test(assert) {
      const html = queryAll(".test").html().trim();
      assert.equal(
        html,
        '<svg class="fa d-icon d-icon-bars svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#bars"></use></svg>'
      );
    },
  });

  componentTest("with replacement", {
    template: '<div class="test">{{d-icon "d-watching"}}</div>',

    test(assert) {
      const html = queryAll(".test").html().trim();
      assert.equal(
        html,
        '<svg class="fa d-icon d-icon-d-watching svg-icon svg-string" xmlns="http://www.w3.org/2000/svg"><use xlink:href="#discourse-bell-exclamation"></use></svg>'
      );
    },
  });
});
