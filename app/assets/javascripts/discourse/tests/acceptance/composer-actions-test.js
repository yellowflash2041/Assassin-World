import {
  acceptance,
  exists,
  queryAll,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, visit } from "@ember/test-helpers";
import Draft from "discourse/models/draft";
import I18n from "I18n";
import { Promise } from "rsvp";
import { _clearSnapshots } from "select-kit/components/composer-actions";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import sinon from "sinon";
import { test } from "qunit";
import { toggleCheckDraftPopup } from "discourse/controllers/composer";

acceptance("Composer Actions", function (needs) {
  needs.user();
  needs.settings({ enable_whispers: true });
  needs.site({ can_tag_topics: true });

  test("creating new topic and then reply_as_private_message keeps attributes", async function (assert) {
    await visit("/");
    await click("button#create-topic");

    await fillIn("#reply-title", "this is the title");
    await fillIn(".d-editor-input", "this is the reply");

    const composerActions = selectKit(".composer-actions");
    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_private_message");

    assert.ok(queryAll("#reply-title").val(), "this is the title");
    assert.ok(queryAll(".d-editor-input").val(), "this is the reply");
  });

  test("replying to post", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await composerActions.expand();

    assert.equal(composerActions.rowByIndex(0).value(), "reply_as_new_topic");
    assert.equal(
      composerActions.rowByIndex(1).value(),
      "reply_as_private_message"
    );
    assert.equal(composerActions.rowByIndex(2).value(), "reply_to_topic");
    assert.equal(composerActions.rowByIndex(3).value(), "toggle_whisper");
    assert.equal(composerActions.rowByIndex(4).value(), "toggle_topic_bump");
    assert.equal(composerActions.rowByIndex(5).value(), undefined);
  });

  test("replying to post - reply_as_private_message", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");

    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_private_message");

    assert.equal(
      queryAll(".users-input .item:nth-of-type(1)").text(),
      "codinghorror"
    );
    assert.ok(
      queryAll(".d-editor-input").val().indexOf("Continuing the discussion") >=
        0
    );
  });

  test("replying to post - reply_to_topic", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await fillIn(
      ".d-editor-input",
      "test replying to topic when initially replied to post"
    );

    await composerActions.expand();
    await composerActions.selectRowByValue("reply_to_topic");

    assert.equal(
      queryAll(".action-title .topic-link").text().trim(),
      "Internationalization / localization"
    );
    assert.equal(
      queryAll(".action-title .topic-link").attr("href"),
      "/t/internationalization-localization/280"
    );
    assert.equal(
      queryAll(".d-editor-input").val(),
      "test replying to topic when initially replied to post"
    );
  });

  test("replying to post - toggle_whisper", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await fillIn(
      ".d-editor-input",
      "test replying as whisper to topic when initially not a whisper"
    );

    await composerActions.expand();
    await composerActions.selectRowByValue("toggle_whisper");

    assert.ok(
      queryAll(".composer-fields .whisper .d-icon-far-eye-slash").length === 1
    );
  });

  test("replying to post - reply_as_new_topic", async function (assert) {
    sinon
      .stub(Draft, "get")
      .returns(Promise.resolve({ draft: "", draft_sequence: 0 }));
    const composerActions = selectKit(".composer-actions");
    const categoryChooser = selectKit(".title-wrapper .category-chooser");
    const categoryChooserReplyArea = selectKit(".reply-area .category-chooser");
    const quote = "test replying as new topic when initially replied to post";

    await visit("/t/internationalization-localization/280");

    await click("#topic-title .d-icon-pencil-alt");
    await categoryChooser.expand();
    await categoryChooser.selectRowByValue(4);
    await click("#topic-title .submit-edit");

    await click("article#post_3 button.reply");
    await fillIn(".d-editor-input", quote);

    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_new_topic");

    assert.equal(categoryChooserReplyArea.header().name(), "faq");
    assert.equal(
      queryAll(".action-title").text().trim(),
      I18n.t("topic.create_long")
    );
    assert.ok(queryAll(".d-editor-input").val().includes(quote));
    sinon.restore();
  });

  test("reply_as_new_topic without a new_topic draft", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".create.reply");
    const composerActions = selectKit(".composer-actions");
    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_new_topic");
    assert.equal(exists(queryAll(".bootbox")), false);
  });

  test("reply_as_new_group_message", async function (assert) {
    await visit("/t/lorem-ipsum-dolor-sit-amet/130");
    await click(".create.reply");
    const composerActions = selectKit(".composer-actions");
    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_new_group_message");

    const items = [];
    queryAll(".users-input .item").each((_, item) =>
      items.push(item.textContent.trim())
    );

    assert.deepEqual(items, ["foo", "foo_group"]);
  });

  test("hide component if no content", async function (assert) {
    await visit("/");
    await click("button#create-topic");

    const composerActions = selectKit(".composer-actions");
    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_private_message");

    assert.ok(composerActions.el().hasClass("is-hidden"));
    assert.equal(composerActions.el().children().length, 0);

    await click("button#create-topic");
    await composerActions.expand();
    assert.equal(composerActions.rows().length, 2);
  });

  test("interactions", async function (assert) {
    const composerActions = selectKit(".composer-actions");
    const quote = "Life is like riding a bicycle.";

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await fillIn(".d-editor-input", quote);
    await composerActions.expand();
    await composerActions.selectRowByValue("reply_to_topic");

    assert.equal(
      queryAll(".action-title").text().trim(),
      "Internationalization / localization"
    );
    assert.equal(queryAll(".d-editor-input").val(), quote);

    await composerActions.expand();

    assert.equal(composerActions.rowByIndex(0).value(), "reply_as_new_topic");
    assert.equal(composerActions.rowByIndex(1).value(), "reply_to_post");
    assert.equal(
      composerActions.rowByIndex(2).value(),
      "reply_as_private_message"
    );
    assert.equal(composerActions.rowByIndex(3).value(), "toggle_whisper");
    assert.equal(composerActions.rowByIndex(4).value(), "toggle_topic_bump");
    assert.equal(composerActions.rows().length, 5);

    await composerActions.selectRowByValue("reply_to_post");
    await composerActions.expand();

    assert.ok(exists(queryAll(".action-title img.avatar")));
    assert.equal(
      queryAll(".action-title .user-link").text().trim(),
      "codinghorror"
    );
    assert.equal(queryAll(".d-editor-input").val(), quote);
    assert.equal(composerActions.rowByIndex(0).value(), "reply_as_new_topic");
    assert.equal(
      composerActions.rowByIndex(1).value(),
      "reply_as_private_message"
    );
    assert.equal(composerActions.rowByIndex(2).value(), "reply_to_topic");
    assert.equal(composerActions.rowByIndex(3).value(), "toggle_whisper");
    assert.equal(composerActions.rowByIndex(4).value(), "toggle_topic_bump");
    assert.equal(composerActions.rows().length, 5);

    await composerActions.selectRowByValue("reply_as_new_topic");
    await composerActions.expand();

    assert.equal(
      queryAll(".action-title").text().trim(),
      I18n.t("topic.create_long")
    );
    assert.ok(queryAll(".d-editor-input").val().includes(quote));
    assert.equal(composerActions.rowByIndex(0).value(), "reply_to_post");
    assert.equal(
      composerActions.rowByIndex(1).value(),
      "reply_as_private_message"
    );
    assert.equal(composerActions.rowByIndex(2).value(), "reply_to_topic");
    assert.equal(composerActions.rowByIndex(3).value(), "shared_draft");
    assert.equal(composerActions.rows().length, 4);

    await composerActions.selectRowByValue("reply_as_private_message");
    await composerActions.expand();

    assert.equal(
      queryAll(".action-title").text().trim(),
      I18n.t("topic.private_message")
    );
    assert.ok(
      queryAll(".d-editor-input").val().indexOf("Continuing the discussion") ===
        0
    );
    assert.equal(composerActions.rowByIndex(0).value(), "reply_as_new_topic");
    assert.equal(composerActions.rowByIndex(1).value(), "reply_to_post");
    assert.equal(composerActions.rowByIndex(2).value(), "reply_to_topic");
    assert.equal(composerActions.rows().length, 3);
  });

  test("replying to post - toggle_topic_bump", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");

    assert.ok(
      queryAll(".composer-fields .no-bump").length === 0,
      "no-bump text is not visible"
    );

    await composerActions.expand();
    await composerActions.selectRowByValue("toggle_topic_bump");

    assert.ok(
      queryAll(".composer-fields .no-bump").length === 1,
      "no-bump icon is visible"
    );

    await composerActions.expand();
    await composerActions.selectRowByValue("toggle_topic_bump");

    assert.ok(
      queryAll(".composer-fields .no-bump").length === 0,
      "no-bump icon is not visible"
    );
  });

  test("replying to post as staff", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    updateCurrentUser({ admin: true });
    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await composerActions.expand();

    assert.equal(composerActions.rows().length, 5);
    assert.equal(composerActions.rowByIndex(4).value(), "toggle_topic_bump");
  });

  test("replying to post as TL3 user", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    updateCurrentUser({ moderator: false, admin: false, trust_level: 3 });
    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await composerActions.expand();

    assert.equal(composerActions.rows().length, 3);
    Array.from(composerActions.rows()).forEach((row) => {
      assert.notEqual(
        row.value,
        "toggle_topic_bump",
        "toggle button is not visible"
      );
    });
  });

  test("replying to post as TL4 user", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    updateCurrentUser({ moderator: false, admin: false, trust_level: 4 });
    await visit("/t/internationalization-localization/280");
    await click("article#post_3 button.reply");
    await composerActions.expand();

    assert.equal(composerActions.rows().length, 4);
    assert.equal(composerActions.rowByIndex(3).value(), "toggle_topic_bump");
  });

  test("replying to first post - reply_as_private_message", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_1 button.reply");

    await composerActions.expand();
    await composerActions.selectRowByValue("reply_as_private_message");

    assert.equal(
      queryAll(".users-input .item:nth-of-type(1)").text(),
      "uwe_keim"
    );
    assert.ok(
      queryAll(".d-editor-input").val().indexOf("Continuing the discussion") >=
        0
    );
  });

  test("editing post", async function (assert) {
    const composerActions = selectKit(".composer-actions");

    await visit("/t/internationalization-localization/280");
    await click("article#post_1 button.show-more-actions");
    await click("article#post_1 button.edit");
    await composerActions.expand();

    assert.equal(composerActions.rows().length, 1);
    assert.equal(composerActions.rowByIndex(0).value(), "reply_to_post");
  });
});

function stubDraftResponse() {
  sinon.stub(Draft, "get").returns(
    Promise.resolve({
      draft:
        '{"reply":"dum de dum da ba.","action":"createTopic","title":"dum da ba dum dum","categoryId":null,"archetypeId":"regular","metaData":null,"composerTime":540879,"typingTime":3400}',
      draft_sequence: 0,
    })
  );
}

acceptance("Composer Actions With New Topic Draft", function (needs) {
  needs.user();
  needs.settings({
    enable_whispers: true,
  });
  needs.site({
    can_tag_topics: true,
  });
  needs.hooks.beforeEach(() => _clearSnapshots());
  needs.hooks.afterEach(() => _clearSnapshots());

  test("shared draft", async function (assert) {
    stubDraftResponse();
    try {
      toggleCheckDraftPopup(true);

      const composerActions = selectKit(".composer-actions");
      const tags = selectKit(".mini-tag-chooser");

      await visit("/");
      await click("#create-topic");

      await fillIn(
        "#reply-title",
        "This is the new text for the title using 'quotes'"
      );

      await fillIn(".d-editor-input", "This is the new text for the post");
      await tags.expand();
      await tags.selectRowByValue("monkey");
      await composerActions.expand();
      await composerActions.selectRowByValue("shared_draft");

      assert.equal(tags.header().value(), "monkey", "tags are not reset");

      assert.equal(
        queryAll("#reply-title").val(),
        "This is the new text for the title using 'quotes'"
      );

      assert.equal(
        queryAll("#reply-control .btn-primary.create .d-button-label").text(),
        I18n.t("composer.create_shared_draft")
      );

      assert.ok(queryAll("#reply-control.composing-shared-draft").length === 1);
      await click(".modal-footer .btn.btn-default");
    } finally {
      toggleCheckDraftPopup(false);
    }
    sinon.restore();
  });

  test("reply_as_new_topic with new_topic draft", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".create.reply");
    const composerActions = selectKit(".composer-actions");
    await composerActions.expand();
    stubDraftResponse();
    await composerActions.selectRowByValue("reply_as_new_topic");
    assert.equal(
      queryAll(".bootbox .modal-body").text(),
      I18n.t("composer.composer_actions.reply_as_new_topic.confirm")
    );
    await click(".modal-footer .btn.btn-default");
    sinon.restore();
  });
});
