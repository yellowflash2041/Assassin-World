import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render } from "@ember/test-helpers";
import { exists, query } from "discourse/tests/helpers/qunit-helpers";
import { hbs } from "ember-cli-htmlbars";
import Bookmark from "discourse/models/bookmark";
import I18n from "I18n";
import { formattedReminderTime } from "discourse/lib/bookmark";
import { tomorrow } from "discourse/lib/time-utils";

module("Integration | Component | bookmark-icon", function (hooks) {
  setupRenderingTest(hooks);

  test("with reminder", async function (assert) {
    this.setProperties({
      bookmark: Bookmark.create({
        reminder_at: tomorrow(this.currentUser.timezone),
        name: "some name",
      }),
    });

    await render(hbs`<BookmarkIcon @bookmark={{this.bookmark}} />`);

    assert.ok(
      exists(".d-icon-discourse-bookmark-clock.bookmark-icon__bookmarked")
    );
    assert.strictEqual(
      query(".svg-icon-title").title,
      I18n.t("bookmarks.created_with_reminder_generic", {
        date: formattedReminderTime(
          this.bookmark.reminder_at,
          this.currentUser.timezone
        ),
        name: "some name",
      })
    );
  });

  test("no reminder", async function (assert) {
    this.set(
      "bookmark",
      Bookmark.create({
        name: "some name",
      })
    );

    await render(hbs`<BookmarkIcon @bookmark={{this.bookmark}} />`);

    assert.ok(exists(".d-icon-bookmark.bookmark-icon__bookmarked"));
    assert.strictEqual(
      query(".svg-icon-title").title,
      I18n.t("bookmarks.created_generic", {
        name: "some name",
      })
    );
  });

  test("null bookmark", async function (assert) {
    this.setProperties({
      bookmark: null,
    });

    await render(hbs`<BookmarkIcon @bookmark={{this.bookmark}} />`);

    assert.ok(exists(".d-icon-bookmark.bookmark-icon"));
    assert.strictEqual(
      query(".svg-icon-title").title,
      I18n.t("bookmarks.create")
    );
  });
});
