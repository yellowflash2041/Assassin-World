import { queryAll } from "discourse/tests/helpers/qunit-helpers";
import { moduleForComponent } from "ember-qunit";
import componentTest from "discourse/tests/helpers/component-test";
import { click, fillIn } from "@ember/test-helpers";

moduleForComponent("simple-list", { integration: true });

componentTest("adding a value", {
  template: "{{simple-list values=values}}",

  beforeEach() {
    this.set("values", "vinkas\nosama");
  },

  async test(assert) {
    assert.ok(
      queryAll(".add-value-btn[disabled]").length,
      "while loading the + button is disabled"
    );

    await fillIn(".add-value-input", "penar");
    await click(".add-value-btn");

    assert.ok(
      queryAll(".values .value").length === 3,
      "it adds the value to the list of values"
    );

    assert.ok(
      queryAll(".values .value[data-index='2'] .value-input")[0].value ===
        "penar",
      "it sets the correct value for added item"
    );

    await fillIn(".add-value-input", "eviltrout");
    await keyEvent(".add-value-input", "keydown", 13); // enter

    assert.ok(
      queryAll(".values .value").length === 4,
      "it adds the value when keying Enter"
    );
  },
});

componentTest("removing a value", {
  template: "{{simple-list values=values}}",

  beforeEach() {
    this.set("values", "vinkas\nosama");
  },

  async test(assert) {
    await click(".values .value[data-index='0'] .remove-value-btn");

    assert.ok(
      queryAll(".values .value").length === 1,
      "it removes the value from the list of values"
    );

    assert.ok(
      queryAll(".values .value[data-index='0'] .value-input")[0].value ===
        "osama",
      "it removes the correct value"
    );
  },
});

componentTest("delimiter support", {
  template: "{{simple-list values=values inputDelimiter='|'}}",

  beforeEach() {
    this.set("values", "vinkas|osama");
  },

  async test(assert) {
    await fillIn(".add-value-input", "eviltrout");
    await click(".add-value-btn");

    assert.ok(
      queryAll(".values .value").length === 3,
      "it adds the value to the list of values"
    );

    assert.ok(
      queryAll(".values .value[data-index='2'] .value-input")[0].value ===
        "eviltrout",
      "it adds the correct value"
    );
  },
});
