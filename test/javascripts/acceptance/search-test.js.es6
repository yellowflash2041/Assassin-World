import { acceptance } from "helpers/qunit-helpers";
acceptance("Search");

test("search", (assert) => {
  visit("/");

  click('#search-button');

  andThen(() => {
    assert.ok(exists('#search-term'), 'it shows the search bar');
    assert.ok(!exists('.search-menu .results ul li'), 'no results by default');
  });

  fillIn('#search-term', 'dev');
  keyEvent('#search-term', 'keyup', 16);
  andThen(() => {
    assert.ok(exists('.search-menu .results ul li'), 'it shows results');
  });

  click('.show-help');

  andThen(() => {
    assert.equal(find('.full-page-search').val(), 'dev', 'it shows the search term');
    assert.ok(exists('.search-advanced-options'), 'advanced search is expanded');
  });
});
