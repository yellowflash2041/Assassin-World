import { default as computed, observes } from 'ember-addons/ember-computed-decorators';
import InputValidation from 'discourse/models/input-validation';
import { load, lookupCache } from 'pretty-text/oneboxer';
import { ajax } from 'discourse/lib/ajax';

export default Ember.Component.extend({
  classNames: ['title-input'],
  watchForLink: Ember.computed.alias('composer.canEditTopicFeaturedLink'),

  didInsertElement() {
    this._super();
    if (this.get('focusTarget') === 'title') {
      this.$('input').putCursorAtEnd();
    }
  },

  @computed('composer.titleLength', 'composer.missingTitleCharacters', 'composer.minimumTitleLength', 'lastValidatedAt')
  validation(titleLength, missingTitleChars, minimumTitleLength, lastValidatedAt) {

    let reason;
    if (titleLength < 1) {
      reason = I18n.t('composer.error.title_missing');
    } else if (missingTitleChars > 0) {
      reason = I18n.t('composer.error.title_too_short', {min: minimumTitleLength});
    } else if (titleLength > this.siteSettings.max_topic_title_length) {
      reason = I18n.t('composer.error.title_too_long', {max: this.siteSettings.max_topic_title_length});
    }

    if (reason) {
      return InputValidation.create({ failed: true, reason, lastShownAt: lastValidatedAt });
    }
  },

  @observes('composer.titleLength', 'watchForLink')
  _titleChanged() {
    if (this.get('composer.titleLength') === 0) { this.set('autoPosted', false); }
    if (this.get('autoPosted') || !this.get('watchForLink')) { return; }

    if (Ember.testing) {
      this._checkForUrl();
    } else {
      Ember.run.debounce(this, this._checkForUrl, 500);
    }
  },

  @observes('composer.replyLength')
  _clearFeaturedLink() {
    if (this.get('watchForLink') && this.get('composer.replyLength') === 0) {
      this.set('composer.featuredLink', null);
    }
  },

  _checkForUrl() {
    if (!this.element || this.isDestroying || this.isDestroyed) { return; }

    if (this.get('isAbsoluteUrl') && (this.get('composer.reply')||"").length === 0) {
      // Try to onebox. If success, update post body and title.
      this.set('composer.loading', true);

      const link = document.createElement('a');
      link.href = this.get('composer.title');

      let loadOnebox = load(link, false, ajax, this.currentUser.id, true);

      if (loadOnebox && loadOnebox.then) {
        loadOnebox.then( () => {
          this._updatePost(lookupCache(this.get('composer.title')));
        }).finally(() => {
          this.set('composer.loading', false);
          Ember.run.schedule('afterRender', () => { this.$('input').putCursorAtEnd(); });
        });
      } else {
        this._updatePost(loadOnebox);
        this.set('composer.loading', false);
        Ember.run.schedule('afterRender', () => { this.$('input').putCursorAtEnd(); });
      }
    }
  },

  _updatePost(html) {
    if (html) {
      this.set('autoPosted', true);
      this.set('composer.featuredLink', this.get('composer.title'));

      const $h = $(html),
            heading = $h.find('h3').length > 0 ? $h.find('h3') : $h.find('h4');

      this.set('composer.reply', this.get('composer.title'));

      if (heading.length > 0 && heading.text().length > 0) {
        this.changeTitle(heading.text());
      } else {
        const firstTitle = $h.attr('title') || $h.find("[title]").attr("title");
        if (firstTitle && firstTitle.length > 0) {
          this.changeTitle(firstTitle);
        }
      }
    }
  },

  changeTitle(val) {
    if (val && val.length > 0) {
      this.set('composer.title', val.trim());
    }
  },

  @computed('composer.title')
  isAbsoluteUrl() {
    return this.get('composer.titleLength') > 0 && /^(https?:)?\/\/[\w\.\-]+/i.test(this.get('composer.title'));
  }
});
