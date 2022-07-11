import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render } from "@ember/test-helpers";
import I18n from "I18n";
import { hbs } from "ember-cli-htmlbars";
import selectKit from "discourse/tests/helpers/select-kit-helper";

const DEFAULT_CONTENT = [
  { id: 1, name: "foo" },
  { id: 2, name: "bar" },
  { id: 3, name: "baz" },
];

const DEFAULT_VALUE = 1;

const setDefaultState = (ctx, options) => {
  const properties = Object.assign(
    {
      content: DEFAULT_CONTENT,
      value: DEFAULT_VALUE,
      nameProperty: "name",
      valueProperty: "id",
      onChange: (value) => {
        ctx.set("value", value);
      },
    },
    options || {}
  );
  ctx.setProperties(properties);
};

module("Integration | Component | select-kit/single-select", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.set("subject", selectKit());
  });

  test("content", async function (assert) {
    setDefaultState(this);

    await render(hbs`<SingleSelect @content={{this.content}} />`);

    await this.subject.expand();

    const content = this.subject.displayedContent();
    assert.strictEqual(content.length, 3, "it shows rows");
    assert.strictEqual(
      content[0].name,
      this.content.firstObject.name,
      "it has the correct name"
    );
    assert.strictEqual(
      content[0].id,
      this.content.firstObject.id.toString(),
      "it has the correct value"
    );
    assert.strictEqual(
      this.subject.header().value(),
      null,
      "it doesn't set a value from the content"
    );
  });

  test("value", async function (assert) {
    setDefaultState(this);

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
      />
    `);

    assert.strictEqual(
      this.subject.header().value(this.content),
      "1",
      "it selects the correct content to display"
    );
  });

  test("options.filterable", async function (assert) {
    setDefaultState(this, { filterable: true });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
        @options={{hash
          filterable=this.filterable
        }}
      />
    `);

    await this.subject.expand();
    assert.ok(this.subject.filter().exists(), "it shows the filter");

    const filter = this.subject.displayedContent()[1].name;
    await this.subject.fillInFilter(filter);
    assert.strictEqual(
      this.subject.displayedContent()[0].name,
      filter,
      "it filters the list"
    );
  });

  test("options.limitMatches", async function (assert) {
    setDefaultState(this, { limitMatches: 1, filterable: true });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
        @options={{hash
          limitMatches=this.limitMatches
          filterable=this.filterable
        }}
      />
    `);

    await this.subject.expand();
    await this.subject.fillInFilter("ba");

    assert.strictEqual(
      this.subject.displayedContent().length,
      1,
      "it returns only 1 result"
    );
  });

  test("valueAttribute (deprecated)", async function (assert) {
    this.set("value", "normal");

    const content = [
      { name: "Smallest", value: "smallest" },
      { name: "Smaller", value: "smaller" },
      { name: "Normal", value: "normal" },
      { name: "Larger", value: "larger" },
      { name: "Largest", value: "largest" },
    ];
    this.set("content", content);

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @valueAttribute="value"
      />
    `);

    await this.subject.expand();

    assert.strictEqual(this.subject.selectedRow().value(), this.value);
  });

  test("none:string", async function (assert) {
    I18n.translations[I18n.locale].js.test = { none: "(default)" };
    setDefaultState(this, { value: 1 });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
        @options={{hash
          none="test.none"
        }}
      />
    `);

    await this.subject.expand();

    const noneRow = this.subject.rowByIndex(0);
    assert.strictEqual(noneRow.value(), null);
    assert.strictEqual(noneRow.name(), I18n.t("test.none"));
  });

  test("none:object", async function (assert) {
    setDefaultState(this, { none: { value: null, name: "(default)" } });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
        @options={{hash
          none=this.none
        }}
      />
    `);

    await this.subject.expand();

    const noneRow = this.subject.rowByIndex(0);
    assert.strictEqual(noneRow.value(), null);
    assert.strictEqual(noneRow.name(), "(default)");
  });

  test("content is a basic array", async function (assert) {
    I18n.translations[I18n.locale].js.test = { none: "(default)" };
    setDefaultState(this, {
      nameProperty: null,
      valueProperty: null,
      value: "foo",
      content: ["foo", "bar", "baz"],
    });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
        @options={{hash
          none="test.none"
        }}
      />
    `);

    await this.subject.expand();

    const noneRow = this.subject.rowByIndex(0);
    assert.strictEqual(noneRow.value(), I18n.t("test.none"));
    assert.strictEqual(noneRow.name(), I18n.t("test.none"));
    assert.strictEqual(this.value, "foo");

    await this.subject.selectRowByIndex(0);

    assert.strictEqual(this.value, null);
  });

  test("selected value can be 0", async function (assert) {
    setDefaultState(this, {
      value: 1,
      content: [
        { id: 0, name: "foo" },
        { id: 1, name: "bar" },
      ],
    });

    await render(hbs`
      <SingleSelect
        @value={{this.value}}
        @content={{this.content}}
        @nameProperty={{this.nameProperty}}
        @valueProperty={{this.valueProperty}}
        @onChange={{this.onChange}}
      />
    `);

    assert.strictEqual(this.subject.header().value(), "1");

    await this.subject.expand();
    await this.subject.selectRowByValue(0);

    assert.strictEqual(this.subject.header().value(), "0");
  });

  test("prevents propagating click event on header", async function (assert) {
    this.setProperties({
      onClick: () => this.set("value", "foo"),
      content: DEFAULT_CONTENT,
      value: DEFAULT_VALUE,
    });

    await render(hbs`
      <DButton @icon="times" @action={{this.onClick}}>
        <SingleSelect
          @value={{this.value}}
          @content={{this.content}}
          @options={{hash preventsClickPropagation=true}}
        />
      </DButton>
    `);

    assert.strictEqual(this.value, DEFAULT_VALUE);
    await this.subject.expand();
    assert.strictEqual(this.value, DEFAULT_VALUE);
  });

  test("labelProperty", async function (assert) {
    this.setProperties({
      content: [{ id: 1, name: "john", foo: "JACKSON" }],
      value: 1,
    });

    await render(hbs`
      <SingleSelect
        @labelProperty="foo"
        @value={{this.value}}
        @content={{this.content}}
      />
    `);

    assert.strictEqual(this.subject.header().label(), "JACKSON");

    await this.subject.expand();

    const row = this.subject.rowByValue(1);

    assert.strictEqual(row.label(), "JACKSON");
  });

  test("titleProperty", async function (assert) {
    this.setProperties({
      content: [{ id: 1, name: "john", foo: "JACKSON" }],
      value: 1,
    });

    await render(hbs`
      <SingleSelect
        @titleProperty="foo"
        @value={{this.value}}
        @content={{this.content}}
      />
    `);

    assert.strictEqual(this.subject.header().title(), "JACKSON");

    await this.subject.expand();

    const row = this.subject.rowByValue(1);

    assert.strictEqual(row.title(), "JACKSON");
  });

  test("langProperty", async function (assert) {
    this.setProperties({
      content: [{ id: 1, name: "john", foo: "be" }],
      value: null,
    });

    await render(
      hbs`<SingleSelect @langProperty="foo" @value={{this.value}} @content={{this.content}} />`
    );

    assert.strictEqual(
      this.subject.header().el().querySelector(".selected-name").lang,
      ""
    );

    await this.subject.expand();

    const row = this.subject.rowByValue(1);
    assert.strictEqual(row.el().lang, "be");

    await this.subject.selectRowByValue(1);

    assert.strictEqual(
      this.subject.header().el().querySelector(".selected-name").lang,
      "be"
    );
  });

  test("name", async function (assert) {
    this.setProperties({
      content: [{ id: 1, name: "john" }],
      value: null,
    });

    await render(
      hbs`<SingleSelect @value={{this.value}} @content={{this.content}} />`
    );

    assert.strictEqual(
      this.subject.header().el().getAttribute("name"),
      I18n.t("select_kit.select_to_filter")
    );

    await this.subject.expand();
    await this.subject.selectRowByValue(1);

    assert.strictEqual(
      this.subject.header().el().getAttribute("name"),
      I18n.t("select_kit.filter_by", {
        name: this.content.firstObject.name,
      })
    );
  });
});
