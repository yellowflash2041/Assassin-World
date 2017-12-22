import componentTest from 'helpers/component-test';
moduleForComponent('multi-select', {
  integration: true,
  beforeEach: function() {
    this.set('subject', selectKit());
  }
});

componentTest('with objects and values', {
  template: '{{multi-select content=items values=values}}',

  beforeEach() {
    this.set('items', [{id: 1, name: 'hello'}, {id: 2, name: 'world'}]);
    this.set('values', [1, 2]);
  },

  test(assert) {
    andThen(() => {
      assert.equal(this.get('subject').header().value(), '1,2');
    });
  }
});

componentTest('with title', {
  template: '{{multi-select title=(i18n "test.title")}}',

  beforeEach() {
    I18n.translations[I18n.locale].js.test = {title: 'My title'};
  },

  test(assert) {
    andThen(() => assert.equal(selectKit().header().title(), 'My title') );
  }
});


componentTest('interactions', {
  template: '{{multi-select none=none content=items values=values}}',

  beforeEach() {
    I18n.translations[I18n.locale].js.test = {none: 'none'};
    this.set('items', [{id: 1, name: 'regis'}, {id: 2, name: 'sam'}, {id: 3, name: 'robin'}]);
    this.set('values', [1, 2]);
  },

  test(assert) {
    this.get('subject').expand();

    andThen(() => {
      assert.equal(
        this.get('subject').highlightedRow().name(),
        'robin',
        'it highlights the first content row'
      );
    });

    this.set('none', 'test.none');

    andThen(() => {
      assert.ok(this.get('subject').noneRow().exists());
      assert.equal(
        this.get('subject').highlightedRow().name(),
        'robin',
        'it highlights the first content row'
      );
    });

    this.get('subject').selectRowByValue(3);

    andThen(() => {
      assert.equal(
        this.get('subject').highlightedRow().name(),
        'none',
        'it highlights none row if no content'
      );
    });

    this.get('subject').fillInFilter('joffrey');

    andThen(() => {
      assert.equal(
        this.get('subject').highlightedRow().name(),
        'joffrey',
        'it highlights create row when filling filter'
      );
    });

    this.get('subject').keyboard().enter();

    andThen(() => {
      assert.equal(
        this.get('subject').highlightedRow().name(),
        'none',
        'it highlights none row after creating content and no content left'
      );
    });

    this.get('subject').keyboard().backspace();

    andThen(() => {
      const $lastSelectedName = this.get('subject').header().el().find('.selected-name').last();
      assert.equal($lastSelectedName.attr('data-name'), 'joffrey');
      assert.ok($lastSelectedName.hasClass('is-highlighted'), 'it highlights the last selected name when using backspace');
    });

    this.get('subject').keyboard().backspace();

    andThen(() => {
      const $lastSelectedName = this.get('subject').header().el().find('.selected-name').last();
      assert.equal($lastSelectedName.attr('data-name'), 'robin', 'it removes the previous highlighted selected content');
      assert.notOk(this.get('subject').rowByValue('joffrey').exists(), 'generated content shouldn’t appear in content when removed');
    });

    this.get('subject').keyboard().selectAll();

    andThen(() => {
      const $highlightedSelectedNames = this.get('subject').header().el().find('.selected-name.is-highlighted');
      assert.equal($highlightedSelectedNames.length, 3, 'it highlights each selected name');
    });

    this.get('subject').keyboard().backspace();

    andThen(() => {
      const $selectedNames = this.get('subject').header().el().find('.selected-name');
      assert.equal($selectedNames.length, 0, 'it removed all selected content');
    });

    andThen(() => {
      assert.ok(this.get('subject').isFocused());
      assert.ok(this.get('subject').isExpanded());
    });

    this.get('subject').keyboard().escape();

    andThen(() => {
      assert.ok(this.get('subject').isFocused());
      assert.notOk(this.get('subject').isExpanded());
    });

    this.get('subject').keyboard().escape();

    andThen(() => {
      assert.notOk(this.get('subject').isFocused());
      assert.notOk(this.get('subject').isExpanded());
    });
  }
});
