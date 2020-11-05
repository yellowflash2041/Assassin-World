import { test, module } from "qunit";
import { parseBBCodeTag } from "pretty-text/engines/discourse-markdown/bbcode-block";

module("Unit | Utility | parseBBCodeTag", function () {
  test("block with multiple quoted attributes", function (assert) {
    const parsed = parseBBCodeTag('[test one="foo" two="bar bar"]', 0, 30);

    assert.equal(parsed.tag, "test");
    assert.equal(parsed.attrs.one, "foo");
    assert.equal(parsed.attrs.two, "bar bar");
  });
});
