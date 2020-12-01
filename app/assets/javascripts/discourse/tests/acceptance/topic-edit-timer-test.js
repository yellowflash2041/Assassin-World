import {
  acceptance,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, visit } from "@ember/test-helpers";
import { skip, test } from "qunit";
import selectKit from "discourse/tests/helpers/select-kit-helper";

acceptance("Topic - Edit timer", function (needs) {
  needs.user();
  needs.pretender((server, helper) => {
    server.post("/t/280/timer", () =>
      helper.response({
        success: "OK",
        execute_at: new Date(
          new Date().getTime() + 1 * 60 * 60 * 1000
        ).toISOString(),
        duration: 1,
        based_on_last_post: false,
        closed: false,
        category_id: null,
      })
    );
  });

  test("default", async function (assert) {
    updateCurrentUser({ moderator: true });
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    assert.equal(
      futureDateInputSelector.header().label(),
      "Select a timeframe"
    );
    assert.equal(futureDateInputSelector.header().value(), null);
  });

  test("autoclose - specific time", async function (assert) {
    updateCurrentUser({ moderator: true });
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("next_week");

    assert.ok(futureDateInputSelector.header().label().includes("Next week"));
    assert.equal(futureDateInputSelector.header().value(), "next_week");

    const regex = /will automatically close in/g;
    const html = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex.test(html));
  });

  skip("autoclose", async function (assert) {
    updateCurrentUser({ moderator: true });
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("next_week");

    assert.ok(futureDateInputSelector.header().label().includes("Next week"));
    assert.equal(futureDateInputSelector.header().value(), "next_week");

    const regex1 = /will automatically close in/g;
    const html1 = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex1.test(html1));

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("pick_date_and_time");

    await fillIn(".future-date-input .date-picker", "2099-11-24");

    assert.ok(
      futureDateInputSelector.header().label().includes("Pick date and time")
    );
    assert.equal(
      futureDateInputSelector.header().value(),
      "pick_date_and_time"
    );

    const regex2 = /will automatically close in/g;
    const html2 = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex2.test(html2));

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("set_based_on_last_post");

    await fillIn(".future-date-input input[type=number]", "2");

    assert.ok(
      futureDateInputSelector
        .header()
        .label()
        .includes("Close based on last post")
    );
    assert.equal(
      futureDateInputSelector.header().value(),
      "set_based_on_last_post"
    );

    const regex3 = /This topic will close.*after the last reply/g;
    const html3 = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex3.test(html3));
  });

  test("close temporarily", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    await timerType.expand();
    await timerType.selectRowByValue("open");

    assert.equal(
      futureDateInputSelector.header().label(),
      "Select a timeframe"
    );
    assert.equal(futureDateInputSelector.header().value(), null);

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("next_week");

    assert.ok(futureDateInputSelector.header().label().includes("Next week"));
    assert.equal(futureDateInputSelector.header().value(), "next_week");

    const regex1 = /will automatically open in/g;
    const html1 = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex1.test(html1));

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("pick_date_and_time");

    await fillIn(".future-date-input .date-picker", "2099-11-24");

    assert.equal(
      futureDateInputSelector.header().label(),
      "Pick date and time"
    );
    assert.equal(
      futureDateInputSelector.header().value(),
      "pick_date_and_time"
    );

    const regex2 = /will automatically open in/g;
    const html2 = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex2.test(html2));
  });

  test("schedule", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const categoryChooser = selectKit(".modal-body .category-chooser");
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    await timerType.expand();
    await timerType.selectRowByValue("publish_to_category");

    assert.equal(categoryChooser.header().label(), "uncategorized");
    assert.equal(categoryChooser.header().value(), null);

    assert.equal(
      futureDateInputSelector.header().label(),
      "Select a timeframe"
    );
    assert.equal(futureDateInputSelector.header().value(), null);

    await categoryChooser.expand();
    await categoryChooser.selectRowByValue("7");

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("next_week");

    assert.ok(futureDateInputSelector.header().label().includes("Next week"));
    assert.equal(futureDateInputSelector.header().value(), "next_week");

    const regex = /will be published to #dev/g;
    const text = queryAll(".future-date-input .topic-status-info")
      .text()
      .trim();
    assert.ok(regex.test(text));
  });

  test("TL4 can't auto-delete", async function (assert) {
    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    const timerType = selectKit(".select-kit.timer-type");

    await timerType.expand();

    assert.ok(!timerType.rowByValue("delete").exists());
  });

  test("auto delete", async function (assert) {
    updateCurrentUser({ moderator: true });
    const timerType = selectKit(".select-kit.timer-type");
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");

    await timerType.expand();
    await timerType.selectRowByValue("delete");

    assert.equal(
      futureDateInputSelector.header().label(),
      "Select a timeframe"
    );
    assert.equal(futureDateInputSelector.header().value(), null);

    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("two_weeks");

    assert.ok(futureDateInputSelector.header().label().includes("Two Weeks"));
    assert.equal(futureDateInputSelector.header().value(), "two_weeks");

    const regex = /will be automatically deleted/g;
    const html = queryAll(".future-date-input .topic-status-info")
      .html()
      .trim();
    assert.ok(regex.test(html));
  });

  test("Inline delete timer", async function (assert) {
    updateCurrentUser({ moderator: true });
    const futureDateInputSelector = selectKit(".future-date-input-selector");

    await visit("/t/internationalization-localization");
    await click(".toggle-admin-menu");
    await click(".topic-admin-status-update button");
    await futureDateInputSelector.expand();
    await futureDateInputSelector.selectRowByValue("next_week");
    await click(".modal-footer button.btn-primary");

    const removeTimerButton = queryAll(
      ".topic-status-info .topic-timer-remove"
    );
    assert.equal(removeTimerButton.attr("title"), "remove timer");

    await click(".topic-status-info .topic-timer-remove");
    const topicStatusInfo = queryAll(".topic-status-info .topic-timer-remove");
    assert.equal(topicStatusInfo.length, 0);
  });
});
