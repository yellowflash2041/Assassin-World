import {
  avatarImg,
  avatarUrl,
  caretRowCol,
  defaultHomepage,
  emailValid,
  escapeExpression,
  extractDomainFromUrl,
  fillMissingDates,
  getRawSize,
  inCodeBlock,
  initializeDefaultHomepage,
  setCaretPosition,
  setDefaultHomepage,
  slugify,
  toAsciiPrintable,
} from "discourse/lib/utilities";
import { skip, test } from "qunit";
import Handlebars from "handlebars";
import { discourseModule } from "discourse/tests/helpers/qunit-helpers";

discourseModule("Unit | Utilities", function () {
  test("escapeExpression", function (assert) {
    assert.equal(escapeExpression(">"), "&gt;", "escapes unsafe characters");

    assert.equal(
      escapeExpression(new Handlebars.SafeString("&gt;")),
      "&gt;",
      "does not double-escape safe strings"
    );

    assert.equal(
      escapeExpression(undefined),
      "",
      "returns a falsy string when given a falsy value"
    );
  });

  test("emailValid", function (assert) {
    assert.ok(
      emailValid("Bob@example.com"),
      "allows upper case in the first part of emails"
    );
    assert.ok(
      emailValid("bob@EXAMPLE.com"),
      "allows upper case in the email domain"
    );
  });

  test("extractDomainFromUrl", function (assert) {
    assert.equal(
      extractDomainFromUrl("http://meta.discourse.org:443/random"),
      "meta.discourse.org",
      "extract domain name from url"
    );
    assert.equal(
      extractDomainFromUrl("meta.discourse.org:443/random"),
      "meta.discourse.org",
      "extract domain regardless of scheme presence"
    );
    assert.equal(
      extractDomainFromUrl("http://192.168.0.1:443/random"),
      "192.168.0.1",
      "works for IP address"
    );
    assert.equal(
      extractDomainFromUrl("http://localhost:443/random"),
      "localhost",
      "works for localhost"
    );
  });

  test("avatarUrl", function (assert) {
    var rawSize = getRawSize;
    assert.blank(avatarUrl("", "tiny"), "no template returns blank");
    assert.equal(
      avatarUrl("/fake/template/{size}.png", "tiny"),
      "/fake/template/" + rawSize(20) + ".png",
      "simple avatar url"
    );
    assert.equal(
      avatarUrl("/fake/template/{size}.png", "large"),
      "/fake/template/" + rawSize(45) + ".png",
      "different size"
    );
  });

  var setDevicePixelRatio = function (value) {
    if (Object.defineProperty && !window.hasOwnProperty("devicePixelRatio")) {
      Object.defineProperty(window, "devicePixelRatio", { value: 2 });
    } else {
      window.devicePixelRatio = value;
    }
  };

  test("avatarImg", function (assert) {
    var oldRatio = window.devicePixelRatio;
    setDevicePixelRatio(2);

    var avatarTemplate = "/path/to/avatar/{size}.png";
    assert.equal(
      avatarImg({ avatarTemplate: avatarTemplate, size: "tiny" }),
      "<img alt='' width='20' height='20' src='/path/to/avatar/40.png' class='avatar'>",
      "it returns the avatar html"
    );

    assert.equal(
      avatarImg({
        avatarTemplate: avatarTemplate,
        size: "tiny",
        title: "evilest trout",
      }),
      "<img alt='' width='20' height='20' src='/path/to/avatar/40.png' class='avatar' title='evilest trout' aria-label='evilest trout'>",
      "it adds a title if supplied"
    );

    assert.equal(
      avatarImg({
        avatarTemplate: avatarTemplate,
        size: "tiny",
        extraClasses: "evil fish",
      }),
      "<img alt='' width='20' height='20' src='/path/to/avatar/40.png' class='avatar evil fish'>",
      "it adds extra classes if supplied"
    );

    assert.blank(
      avatarImg({ avatarTemplate: "", size: "tiny" }),
      "it doesn't render avatars for invalid avatar template"
    );

    setDevicePixelRatio(oldRatio);
  });

  test("defaultHomepage via meta tag", function (assert) {
    let meta = document.createElement("meta");
    meta.name = "discourse_current_homepage";
    meta.content = "hot";
    document.body.appendChild(meta);
    initializeDefaultHomepage(this.siteSettings);
    assert.equal(
      defaultHomepage(),
      "hot",
      "default homepage is pulled from <meta name=discourse_current_homepage>"
    );
    document.body.removeChild(meta);
  });

  test("defaultHomepage via site settings", function (assert) {
    this.siteSettings.top_menu = "top|latest|hot";
    initializeDefaultHomepage(this.siteSettings);
    assert.equal(
      defaultHomepage(),
      "top",
      "default homepage is the first item in the top_menu site setting"
    );
  });

  test("setDefaultHomepage", function (assert) {
    initializeDefaultHomepage(this.siteSettings);
    assert.equal(defaultHomepage(), "latest");
    setDefaultHomepage("top");
    assert.equal(defaultHomepage(), "top");
  });

  test("caretRowCol", function (assert) {
    var textarea = document.createElement("textarea");
    const content = document.createTextNode("01234\n56789\n012345");
    textarea.appendChild(content);
    document.body.appendChild(textarea);

    const assertResult = (setCaretPos, expectedRowNum, expectedColNum) => {
      setCaretPosition(textarea, setCaretPos);

      const result = caretRowCol(textarea);
      assert.equal(
        result.rowNum,
        expectedRowNum,
        "returns the right row of the caret"
      );
      assert.equal(
        result.colNum,
        expectedColNum,
        "returns the right col of the caret"
      );
    };

    assertResult(0, 1, 0);
    assertResult(5, 1, 5);
    assertResult(6, 2, 0);
    assertResult(11, 2, 5);
    assertResult(14, 3, 2);

    document.body.removeChild(textarea);
  });

  test("toAsciiPrintable", function (assert) {
    const accentedString = "Créme_Brûlée!";
    const unicodeString = "談話";

    assert.equal(
      toAsciiPrintable(accentedString, "discourse"),
      "Creme_Brulee!",
      "it replaces accented characters with the appropriate ASCII equivalent"
    );

    assert.equal(
      toAsciiPrintable(unicodeString, "discourse"),
      "discourse",
      "it uses the fallback string when unable to convert"
    );

    assert.strictEqual(
      typeof toAsciiPrintable(unicodeString),
      "undefined",
      "it returns undefined when unable to convert and no fallback is provided"
    );
  });

  test("slugify", function (assert) {
    const asciiString = "--- 0__( Some-cool Discourse Site! )__0 --- ";
    const accentedString = "Créme_Brûlée!";
    const unicodeString = "談話";

    assert.equal(
      slugify(asciiString),
      "0-some-cool-discourse-site-0",
      "it properly slugifies an ASCII string"
    );

    assert.equal(
      slugify(accentedString),
      "crme-brle",
      "it removes accented characters"
    );

    assert.equal(slugify(unicodeString), "", "it removes unicode characters");
  });

  test("fillMissingDates", function (assert) {
    const startDate = "2017-11-12"; // YYYY-MM-DD
    const endDate = "2017-12-12"; // YYYY-MM-DD
    const data =
      '[{"x":"2017-11-12","y":3},{"x":"2017-11-27","y":2},{"x":"2017-12-06","y":9},{"x":"2017-12-11","y":2}]';

    assert.equal(
      fillMissingDates(JSON.parse(data), startDate, endDate).length,
      31,
      "it returns a JSON array with 31 dates"
    );
  });

  test("inCodeBlock", function (assert) {
    const text =
      "000\n\n```\n111\n```\n\n000\n\n`111 111`\n\n000\n\n[code]\n111\n[/code]\n\n    111\n\t111\n\n000`000";
    for (let i = 0; i < text.length; ++i) {
      if (text[i] === "0") {
        assert.notOk(
          inCodeBlock(text, i),
          `position ${i} is not in code block`
        );
      } else if (text[i] === "1") {
        assert.ok(inCodeBlock(text, i), `position ${i} is in code block`);
      }
    }
  });

  skip("inCodeBlock - runs fast", function (assert) {
    const phrase = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    const text = `${phrase}\n\n\`\`\`\n${phrase}\n\`\`\`\n\n${phrase}\n\n\`${phrase}\n${phrase}\n\n${phrase}\n\n[code]\n${phrase}\n[/code]\n\n${phrase}\n\n    ${phrase}\n\n\`${phrase}\`\n\n${phrase}`;

    let time = Number.MAX_VALUE;
    for (let i = 0; i < 10; ++i) {
      const start = performance.now();
      inCodeBlock(text, text.length);
      const end = performance.now();
      time = Math.min(time, end - start);
    }

    // This runs in 'keyUp' event handler so it should run as fast as
    // possible. It should take less than 1ms for the test text.
    assert.ok(time < 10);
  });
});
