import { acceptance } from "helpers/qunit-helpers";
acceptance("Search - Full Page");

test("search", (assert) => {
  visit("/search?q=trout");

  andThen(() => {
    assert.ok(find('input.search').length > 0);
    assert.ok(find('.topic-list-item').length > 0);
  });
});
