import {
  acceptance,
  count,
  exists,
  query,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, triggerKeyEvent, visit } from "@ember/test-helpers";
import I18n from "I18n";
import searchFixtures from "discourse/tests/fixtures/search-fixtures";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { test } from "qunit";
import { DEFAULT_TYPE_FILTER } from "discourse/widgets/search-menu";

acceptance("Search - Anonymous", function (needs) {
  needs.pretender((server, helper) => {
    server.get("/search/query", (request) => {
      if (request.queryParams.type_filter === DEFAULT_TYPE_FILTER) {
        // posts/topics are not present in the payload by default
        return helper.response({
          users: searchFixtures["search/query"]["users"],
          categories: searchFixtures["search/query"]["categories"],
          tags: searchFixtures["search/query"]["tags"],
          groups: searchFixtures["search/query"]["groups"],
          grouped_search_result:
            searchFixtures["search/query"]["grouped_search_result"],
        });
      }
      return helper.response(searchFixtures["search/query"]);
    });
  });

  test("search", async function (assert) {
    await visit("/");

    await click("#search-button");

    assert.ok(exists("#search-term"), "it shows the search input");
    assert.ok(
      exists(".show-advanced-search"),
      "it shows full page search button"
    );
    assert.ok(
      exists(".search-menu .results ul li.search-random-quick-tip"),
      "shows random quick tip by default"
    );

    await fillIn("#search-term", "dev");

    assert.ok(
      !exists(".search-menu .results ul li.search-random-quick-tip"),
      "quick tip no longer shown"
    );

    assert.equal(
      query(
        ".search-menu .results ul.search-menu-initial-options li:first-child .search-item-slug"
      ).innerText.trim(),
      `dev ${I18n.t("search.in_topics_posts")}`,
      "shows topic search as first dropdown item"
    );

    assert.ok(
      exists(".search-menu .search-result-category ul li"),
      "shows matching category results"
    );

    assert.ok(
      exists(".search-menu .search-result-user ul li"),
      "shows matching user results"
    );

    await triggerKeyEvent(".search-menu", "keydown", 40);
    await click(document.activeElement);

    assert.ok(
      exists(".search-menu .search-result-topic ul li"),
      "shows topic results"
    );
    assert.ok(
      exists(".search-menu .results ul li .topic-title[data-topic-id]"),
      "topic has data-topic-id"
    );

    await click(".show-advanced-search");

    assert.equal(
      query(".full-page-search").value,
      "dev",
      "it goes to full search page and preserves the search term"
    );

    assert.ok(
      exists(".search-advanced-options"),
      "advanced search is expanded"
    );
  });

  test("search button toggles search menu", async function (assert) {
    await visit("/");

    await click("#search-button");
    assert.ok(exists(".search-menu"));

    await click(".d-header"); // click outside
    assert.ok(!exists(".search-menu"));

    await click("#search-button");
    assert.ok(exists(".search-menu"));

    await click("#search-button"); // toggle same button
    assert.ok(!exists(".search-menu"));
  });

  test("search scope", async function (assert) {
    const firstResult =
      ".search-menu .results .search-menu-assistant-item:first-child";

    await visit("/tag/important");
    await click("#search-button");

    assert.equal(
      query(firstResult).textContent.trim(),
      `${I18n.t("search.in")} test`,
      "contenxtual tag search is first available option with no term"
    );

    await fillIn("#search-term", "smth");

    assert.equal(
      query(firstResult).textContent.trim(),
      `smth ${I18n.t("search.in")} test`,
      "tag-scoped search is first available option"
    );

    await visit("/c/bug");
    await click("#search-button");

    assert.equal(
      query(firstResult).textContent.trim(),
      `smth ${I18n.t("search.in")} bug`,
      "category-scoped search is first available option"
    );

    assert.ok(
      exists(`${firstResult} span.badge-wrapper`),
      "category badge is a span (i.e. not a link)"
    );

    await visit("/t/internationalization-localization/280");
    await click("#search-button");

    assert.equal(
      query(firstResult).textContent.trim(),
      `smth ${I18n.t("search.in_this_topic")}`,
      "topic-scoped search is first available option"
    );

    await visit("/u/eviltrout");
    await click("#search-button");

    assert.equal(
      query(firstResult).textContent.trim(),
      `smth ${I18n.t("search.in_posts_by", {
        username: "eviltrout",
      })}`,
      "user-scoped search is first available option"
    );
  });

  test("search scope for topics", async function (assert) {
    await visit("/t/internationalization-localization/280/1");

    await click("#search-button");

    const firstResult =
      ".search-menu .results .search-menu-assistant-item:first-child";

    assert.equal(
      query(firstResult).textContent.trim(),
      I18n.t("search.in_this_topic"),
      "contenxtual topic search is first available option"
    );

    await fillIn("#search-term", "a proper");
    await focus("input#search-term");
    await triggerKeyEvent(".search-menu", "keydown", 40);

    await click(document.activeElement);
    assert.ok(
      exists(".search-menu .search-result-post ul li"),
      "clicking first option formats results as posts"
    );

    assert.equal(
      query("#post_7 span.highlighted").textContent.trim(),
      "a proper",
      "highlights the post correctly"
    );

    await click(".clear-search");
    assert.equal(query("#search-term").value, "", "clear button works");
  });

  test("Right filters are shown in full page search", async function (assert) {
    const inSelector = selectKit(".select-kit#in");

    await visit("/search?expanded=true");

    await inSelector.expand();

    assert.ok(inSelector.rowByValue("first").exists());
    assert.ok(inSelector.rowByValue("pinned").exists());
    assert.ok(inSelector.rowByValue("wiki").exists());
    assert.ok(inSelector.rowByValue("images").exists());

    assert.notOk(inSelector.rowByValue("unseen").exists());
    assert.notOk(inSelector.rowByValue("posted").exists());
    assert.notOk(inSelector.rowByValue("watching").exists());
    assert.notOk(inSelector.rowByValue("tracking").exists());
    assert.notOk(inSelector.rowByValue("bookmarks").exists());

    assert.notOk(exists(".search-advanced-options .in-likes"));
    assert.notOk(exists(".search-advanced-options .in-private"));
    assert.notOk(exists(".search-advanced-options .in-seen"));
  });
});

acceptance("Search - Authenticated", function (needs) {
  needs.user();

  needs.pretender((server, helper) => {
    server.get("/search/query", (request) => {
      if (request.queryParams.term.includes("empty")) {
        return helper.response({
          posts: [],
          users: [],
          categories: [],
          tags: [],
          groups: [],
          grouped_search_result: {
            more_posts: null,
            more_users: null,
            more_categories: null,
            term: "plans test",
            search_log_id: 1,
            more_full_page_results: null,
            can_create_topic: true,
            error: null,
            type_filter: null,
            post_ids: [],
            user_ids: [],
            category_ids: [],
            tag_ids: [],
            group_ids: [],
          },
        });
      }

      return helper.response(searchFixtures["search/query"]);
    });
  });

  test("Right filters are shown in full page search", async function (assert) {
    const inSelector = selectKit(".select-kit#in");

    await visit("/search?expanded=true");

    await inSelector.expand();

    assert.ok(inSelector.rowByValue("first").exists());
    assert.ok(inSelector.rowByValue("pinned").exists());
    assert.ok(inSelector.rowByValue("wiki").exists());
    assert.ok(inSelector.rowByValue("images").exists());

    assert.ok(inSelector.rowByValue("unseen").exists());
    assert.ok(inSelector.rowByValue("posted").exists());
    assert.ok(inSelector.rowByValue("watching").exists());
    assert.ok(inSelector.rowByValue("tracking").exists());
    assert.ok(inSelector.rowByValue("bookmarks").exists());

    assert.ok(exists(".search-advanced-options .in-likes"));
    assert.ok(exists(".search-advanced-options .in-private"));
    assert.ok(exists(".search-advanced-options .in-seen"));
  });

  test("Works with empty result sets", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#search-button");
    await fillIn("#search-term", "plans");
    await focus("input#search-term");
    await triggerKeyEvent(".search-menu", "keydown", 40);
    await click(document.activeElement);

    assert.notEqual(count(".search-menu .results .item"), 0);

    await fillIn("#search-term", "plans empty");
    await triggerKeyEvent("#search-term", "keydown", 13);

    assert.equal(count(".search-menu .results .item"), 0);
    assert.equal(count(".search-menu .results .no-results"), 1);
  });

  test("search dropdown keyboard navigation", async function (assert) {
    const keyEnter = 13;
    const keyArrowDown = 40;
    const keyArrowUp = 38;
    const keyEsc = 27;
    const keyA = 65;
    const container = ".search-menu .results";

    await visit("/");
    await click("#search-button");
    await fillIn("#search-term", "dev");

    assert.ok(exists(query(`${container} ul li`)), "has a list of items");

    await triggerKeyEvent("#search-term", "keydown", keyEnter);
    assert.ok(
      exists(query(`${container} .search-result-topic`)),
      "has topic results"
    );

    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);

    assert.equal(
      document.activeElement.getAttribute("href"),
      query(`${container} li:first-child a`).getAttribute("href"),
      "arrow down selects first element"
    );

    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);

    assert.equal(
      document.activeElement.getAttribute("href"),
      query(`${container} li:nth-child(2) a`).getAttribute("href"),
      "arrow down selects next element"
    );

    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);
    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);
    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);
    await triggerKeyEvent("#search-term", "keydown", keyArrowDown);

    assert.equal(
      document.activeElement.getAttribute("href"),
      "/search?q=dev",
      "arrow down sets focus to more results link"
    );

    await triggerKeyEvent(".search-menu", "keydown", keyEsc);
    assert.ok(!exists(".search-menu:visible"), "Esc removes search dropdown");

    await click("#search-button");
    await triggerKeyEvent(".search-menu", "keydown", keyArrowDown);
    await triggerKeyEvent(".search-menu", "keydown", keyArrowUp);

    assert.equal(
      document.activeElement.tagName.toLowerCase(),
      "input",
      "arrow up sets focus to search term input"
    );

    await triggerKeyEvent(".search-menu", "keydown", keyEsc);
    await click("#create-topic");
    await click("#search-button");
    await triggerKeyEvent(".search-menu", "keydown", keyArrowDown);

    const firstLink = query(`${container} li:nth-child(1) a`).getAttribute(
      "href"
    );
    await triggerKeyEvent(".search-menu", "keydown", keyA);

    assert.equal(
      query("#reply-control textarea").value,
      `${window.location.origin}${firstLink}`,
      "hitting A when focused on a search result copies link to composer"
    );
  });
});

acceptance("Search - with tagging enabled", function (needs) {
  needs.user();
  needs.settings({ tagging_enabled: true });

  test("displays tags", async function (assert) {
    await visit("/");
    await click("#search-button");
    await fillIn("#search-term", "dev");
    await triggerKeyEvent("#search-term", "keydown", 13);

    assert.equal(
      query(
        ".search-menu .results ul li:nth-of-type(1) .discourse-tags"
      ).textContent.trim(),
      "dev slow",
      "tags displayed in search results"
    );
  });

  test("displays tag shortcuts", async function (assert) {
    await visit("/");

    await click("#search-button");

    await fillIn("#search-term", "dude #monk");
    await triggerKeyEvent("#search-term", "keyup", 51);

    const firstItem =
      ".search-menu .results ul.search-menu-assistant .search-link";
    assert.ok(exists(query(firstItem)));

    const firstTag = query(`${firstItem} .search-item-tag`).textContent.trim();
    assert.equal(firstTag, "monkey");
  });
});

acceptance("Search - assistant", function (needs) {
  needs.user();

  needs.pretender((server, helper) => {
    server.get("/u/search/users", () => {
      return helper.response({
        users: [
          {
            username: "TeaMoe",
            name: "TeaMoe",
            avatar_template:
              "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
          },
          {
            username: "TeamOneJ",
            name: "J Cobb",
            avatar_template:
              "https://avatars.discourse.org/v3/letter/t/3d9bf3/{size}.png",
          },
          {
            username: "kudos",
            name: "Team Blogeto.com",
            avatar_template:
              "/user_avatar/meta.discourse.org/kudos/{size}/62185_1.png",
          },
        ],
      });
    });
  });

  test("shows category shortcuts when typing #", async function (assert) {
    await visit("/");

    await click("#search-button");

    await fillIn("#search-term", "#");
    await triggerKeyEvent("#search-term", "keyup", 51);

    const firstCategory =
      ".search-menu .results ul.search-menu-assistant .search-link";
    assert.ok(exists(query(firstCategory)));

    const firstResultSlug = query(
      `${firstCategory} .category-name`
    ).textContent.trim();

    await click(firstCategory);
    assert.equal(query("#search-term").value, `#${firstResultSlug}`);

    await fillIn("#search-term", "sam #");
    await triggerKeyEvent("#search-term", "keyup", 51);

    assert.ok(exists(query(firstCategory)));
    assert.equal(
      query(
        ".search-menu .results ul.search-menu-assistant .search-item-prefix"
      ).innerText,
      "sam "
    );

    await click(firstCategory);
    assert.equal(query("#search-term").value, `sam #${firstResultSlug}`);
  });

  test("shows in: shortcuts", async function (assert) {
    await visit("/");
    await click("#search-button");

    const firstTarget =
      ".search-menu .results ul.search-menu-assistant .search-link .search-item-slug";

    await fillIn("#search-term", "in:");
    await triggerKeyEvent("#search-term", "keyup", 51);
    assert.equal(query(firstTarget).innerText, "in:title");

    await fillIn("#search-term", "sam in:");
    await triggerKeyEvent("#search-term", "keyup", 51);
    assert.equal(query(firstTarget).innerText, "sam in:title");

    await fillIn("#search-term", "in:pers");
    await triggerKeyEvent("#search-term", "keyup", 51);
    assert.equal(query(firstTarget).innerText, "in:personal");
  });

  test("shows users when typing @", async function (assert) {
    await visit("/");

    await click("#search-button");

    await fillIn("#search-term", "@");
    await triggerKeyEvent("#search-term", "keyup", 51);

    const firstUser =
      ".search-menu .results ul.search-menu-assistant .search-item-user";
    const firstUsername = query(firstUser).innerText.trim();
    assert.equal(firstUsername, "TeaMoe");

    await click(query(firstUser));
    assert.equal(query("#search-term").value, `@${firstUsername}`);
  });
});
