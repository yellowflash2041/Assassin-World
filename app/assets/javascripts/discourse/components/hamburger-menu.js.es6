import { default as computed, on } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  classNameBindings: ['visible::slideright'],
  elementId: 'hamburger-menu',

  @computed()
  showKeyboardShortcuts() {
    return !Discourse.Mobile.mobileView && !this.capabilities.touch;
  },

  @computed()
  showMobileToggle() {
    return Discourse.Mobile.mobileView || (this.siteSettings.enable_mobile_theme && this.capabilities.touch);
  },

  @computed()
  mobileViewLinkTextKey() {
    return Discourse.Mobile.mobileView ? "desktop_view" : "mobile_view";
  },

  @computed()
  faqUrl() {
    return this.siteSettings.faq_url ? this.siteSettings.faq_url : Discourse.getURL('/faq');
  },

  @on('didInsertElement')
  _bindEvents() {
    this.$().on('click.discourse-hamburger', 'a', () => {
      this.set('visible', false);
    });

    $('body').on('keydown.discourse-hambuger', (e) => {
      if (e.which === 27) {
        this.set('visible', false);
      }
    });

    if (this.capabilities.touch) {
      $('body').on('swipeleft.discourse-hamburger', () => this.set('visible', true));
      $('body').on('swiperight.discourse-hamburger', () => this.set('visible', false));
    }
  },

  @on('willDestroyElement')
  _removeEvents() {
    this.$().off('click.discourse-hamburger');
    $('body').off('keydown.discourse-hambuger');
    $('body').off('swipeleft.discourse-hamburger');
    $('body').off('swiperight.discourse-hamburger');
  },

  @computed()
  categories() {
    const hideUncategorized = !this.siteSettings.allow_uncategorized_topics;
    const showSubcatList = this.siteSettings.show_subcategory_list;
    const isStaff = Discourse.User.currentProp('staff');

    return Discourse.Category.list().reject((c) => {
      if (showSubcatList && c.get('parent_category_id')) { return true; }
      if (hideUncategorized && c.get('isUncategorizedCategory') && !isStaff) { return true; }
      return false;
    });
  },

  actions: {
    close() {
      this.set('visible', false);
    },
    keyboardShortcuts() {
      this.sendAction('showKeyboardAction');
    },
    toggleMobileView() {
      Discourse.Mobile.toggleMobileView();
    }
  }
});
