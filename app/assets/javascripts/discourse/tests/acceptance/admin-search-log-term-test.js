import { skip } from "qunit";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";
acceptance("Admin - Search Log Term", { loggedIn: true });

skip("show search log term details", async (assert) => {
  await visit("/admin/logs/search_logs/term?term=ruby");

  assert.ok($("div.search-logs-filter").length, "has the search type filter");
  assert.ok(exists("canvas.chartjs-render-monitor"), "has graph canvas");
  assert.ok(exists("div.header-search-results"), "has header search results");
});
