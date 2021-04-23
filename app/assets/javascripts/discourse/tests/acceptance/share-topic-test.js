import { click, visit } from "@ember/test-helpers";
import {
  acceptance,
  exists,
  queryAll,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { test } from "qunit";

acceptance("Share and Invite modal", function (needs) {
  needs.user();

  test("Topic footer button", async function (assert) {
    await visit("/t/internationalization-localization/280");

    assert.ok(
      exists("#topic-footer-button-share-and-invite"),
      "the button exists"
    );

    await click("#topic-footer-button-share-and-invite");

    assert.ok(exists(".share-topic-modal"), "it shows the modal");

    assert.ok(
      queryAll("input.invite-link")
        .val()
        .includes("/t/internationalization-localization/280?u=eviltrout"),
      "it shows the topic sharing url"
    );

    assert.ok(queryAll(".social-link").length > 1, "it shows social sources");

    assert.ok(
      exists(".btn-primary[aria-label='Notify']"),
      "it shows the notify button"
    );

    assert.ok(
      exists(".btn-primary[aria-label='Invite']"),
      "it shows the invite button"
    );
  });

  test("Post date link", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#post_2 .post-info.post-date a");

    assert.ok(exists("#share-link"), "it shows the share modal");
  });
});

acceptance("Share and Invite modal - mobile", function (needs) {
  needs.user();
  needs.mobileView();

  test("Topic footer mobile button", async function (assert) {
    await visit("/t/internationalization-localization/280");

    assert.ok(
      !exists("#topic-footer-button-share-and-invite"),
      "the button doesn’t exist"
    );

    const subject = selectKit(".topic-footer-mobile-dropdown");
    await subject.expand();
    await subject.selectRowByValue("share-and-invite");

    assert.ok(exists(".share-topic-modal"), "it shows the modal");
  });
});

acceptance("Share url with badges disabled - desktop", function (needs) {
  needs.user();
  needs.settings({ enable_badges: false });
  test("topic footer button - badges disabled - desktop", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-button-share-and-invite");

    assert.notOk(
      queryAll("input.invite-link").val().includes("?u=eviltrout"),
      "it doesn't add the username param when badges are disabled"
    );
  });
});
