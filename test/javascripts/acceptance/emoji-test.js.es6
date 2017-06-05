import { acceptance } from "helpers/qunit-helpers";

acceptance("Emoji", { loggedIn: true });

test("emoji is cooked properly", () => {
  visit("/t/internationalization-localization/280");
  click('#topic-footer-buttons .btn.create');

  fillIn('.d-editor-input', "this is an emoji :blonde_woman:");
  andThen(() => {
    equal(find('.d-editor-preview:visible').html().trim(), "<p>this is an emoji <img src=\"/images/emoji/emoji_one/blonde_woman.png?v=5\" title=\":blonde_woman:\" class=\"emoji\" alt=\":blonde_woman:\"></p>");
  });

  click('#reply-control .btn.create');
  andThen(() => {
    equal(find('.topic-post:last .cooked p').html().trim(), "this is an emoji <img src=\"/images/emoji/emoji_one/blonde_woman.png?v=5\" title=\":blonde_woman:\" class=\"emoji\" alt=\":blonde_woman:\">");
  });
});

test("skin toned emoji is cooked properly", () => {
  visit("/t/internationalization-localization/280");
  click('#topic-footer-buttons .btn.create');

  fillIn('.d-editor-input', "this is an emoji :blonde_woman:t5:");
  andThen(() => {
    equal(find('.d-editor-preview:visible').html().trim(), "<p>this is an emoji <img src=\"/images/emoji/emoji_one/blonde_woman/5.png?v=5\" title=\":blonde_woman:t5:\" class=\"emoji\" alt=\":blonde_woman:t5:\"></p>");
  });

  click('#reply-control .btn.create');
  andThen(() => {
    equal(find('.topic-post:last .cooked p').html().trim(), "this is an emoji <img src=\"/images/emoji/emoji_one/blonde_woman/5.png?v=5\" title=\":blonde_woman:t5:\" class=\"emoji\" alt=\":blonde_woman:t5:\">");
  });
});
