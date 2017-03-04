import { searchContextDescription } from 'discourse/lib/search';
import { h } from 'virtual-dom';
import { createWidget } from 'discourse/widgets/widget';

createWidget('search-term', {
  tagName: 'input',
  buildId: () => 'search-term',
  buildKey: (attrs) => `search-term-${attrs.id}`,
  KEYCODE_AT_SIGN: 50,
  KEYCODE_POUND_SIGN: 51,

  defaultState() {
    return { autocompleteIsOpen: false, shiftKeyEntry: false };
  },

  buildAttributes(attrs) {
    return { type: 'text',
             value: attrs.value || '',
             placeholder: attrs.contextEnabled ? "" : I18n.t('search.title') };
  },

  keyDown(e) {
    const state = this.state;
    state.shiftKeyEntry = e.shiftKey &&
      (e.keyCode === this.KEYCODE_AT_SIGN || e.keyCode === this.KEYCODE_POUND_SIGN);

    if ($(`#${this.buildId()}`).parent().find('.autocomplete').length !== 0) {
      state.autocompleteIsOpen = true;
    } else  {
      state.autocompleteIsOpen = false;
    }
  },

  keyUp(e) {
    const state = this.state;
    if (e.which === 13 && !state.shiftKeyEntry && !state.autocompleteIsOpen) {
      return this.sendWidgetAction('fullSearch');
    }

    const val = this.attrs.value;
    const newVal = $(`#${this.buildId()}`).val();

    if (newVal !== val) {
      this.sendWidgetAction('searchTermChanged', newVal);
    }
  }
});

createWidget('search-context', {
  tagName: 'div.search-context',

  html(attrs) {
    const service = this.register.lookup('search-service:main');
    const ctx = service.get('searchContext');

    const result = [];
    if (ctx) {
      const description = searchContextDescription(Ember.get(ctx, 'type'),
                                                   Ember.get(ctx, 'user.username') || Ember.get(ctx, 'category.name'));
      result.push(h('label', [
                    h('input', { type: 'checkbox', checked: attrs.contextEnabled }),
                    ' ',
                    description
                  ]));
    }

    if (!attrs.contextEnabled) {
      result.push(this.attach('link', { href: attrs.url,
                                        label: 'show_help',
                                        className: 'show-help' }));
    }

    result.push(h('div.clearfix'));
    return result;
  },

  click() {
    const val = $('.search-context input').is(':checked');
    if (val !== this.attrs.contextEnabled) {
      this.sendWidgetAction('searchContextChanged', val);
    }
  }
});
