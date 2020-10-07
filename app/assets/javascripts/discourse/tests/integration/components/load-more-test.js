import { moduleForComponent } from "ember-qunit";
import { configureEyeline } from "discourse/lib/eyeline";
import componentTest from "discourse/tests/helpers/component-test";

moduleForComponent("load-more", { integration: true });

componentTest("updates once after initialization", {
  template: `
    {{#load-more selector=".numbers tr" action=loadMore}}
      <table class="numbers"><tr></tr></table>
    {{/load-more}}`,

  beforeEach() {
    this.set("loadMore", () => this.set("loadedMore", true));
    configureEyeline({
      skipUpdate: false,
      rootElement: "#ember-testing",
    });
  },

  afterEach() {
    configureEyeline();
  },

  test(assert) {
    assert.ok(this.loadedMore);
  },
});
