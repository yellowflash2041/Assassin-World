import componentTest, {
  setupRenderingTest,
} from "discourse/tests/helpers/component-test";
import { discourseModule } from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";

discourseModule(
  "Integration | Component | select-kit/user-chooser",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.set("subject", selectKit());
    });

    componentTest("displays usernames", {
      template: `{{user-chooser value=value}}`,

      beforeEach() {
        this.set("value", ["bob", "martin"]);
      },

      async test(assert) {
        assert.equal(this.subject.header().name(), "bob,martin");
      },
    });

    componentTest("can remove a username", {
      template: `{{user-chooser value=value}}`,

      beforeEach() {
        this.set("value", ["bob", "martin"]);
      },

      async test(assert) {
        await this.subject.deselectItem("bob");
        assert.equal(this.subject.header().name(), "martin");
      },
    });
  }
);
