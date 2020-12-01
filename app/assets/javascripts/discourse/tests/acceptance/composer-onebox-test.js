import { acceptance, queryAll } from "discourse/tests/helpers/qunit-helpers";
import { click, fillIn, visit } from "@ember/test-helpers";
import { test } from "qunit";

acceptance("Composer - Onebox", function (needs) {
  needs.user();
  needs.settings({
    max_oneboxes_per_post: 2,
    enable_markdown_linkify: true,
  });

  test("Preview update should respect max_oneboxes_per_post site setting", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#topic-footer-buttons .btn.create");

    await fillIn(
      ".d-editor-input",
      `
http://www.example.com/has-title.html
This is another test http://www.example.com/has-title.html

http://www.example.com/no-title.html

This is another test http://www.example.com/no-title.html
This is another test http://www.example.com/has-title.html

http://www.example.com/has-title.html
        `
    );

    assert.equal(
      queryAll(".d-editor-preview:visible").html().trim(),
      `
<p><aside class=\"onebox\"><article class=\"onebox-body\"><h3><a href=\"http://www.example.com/article.html\">An interesting article</a></h3></article></aside><br>
This is another test <a href=\"http://www.example.com/has-title.html\" class=\"inline-onebox\">This is a great title</a></p>
<p><a href=\"http://www.example.com/no-title.html\" class=\"onebox\" target=\"_blank\">http://www.example.com/no-title.html</a></p>
<p>This is another test <a href=\"http://www.example.com/no-title.html\" class=\"\">http://www.example.com/no-title.html</a><br>
This is another test <a href=\"http://www.example.com/has-title.html\" class=\"inline-onebox\">This is a great title</a></p>
<p><aside class=\"onebox\"><article class=\"onebox-body\"><h3><a href=\"http://www.example.com/article.html\">An interesting article</a></h3></article></aside></p>
        `.trim()
    );
  });
});
