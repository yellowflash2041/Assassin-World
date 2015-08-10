import Presence from 'discourse/mixins/presence';
import searchForTerm from 'discourse/lib/search-for-term';

let _dontSearch = false;

export default Em.Controller.extend(Presence, {
  typeFilter: null,

  contextType: function(key, value){
    if(arguments.length > 1) {
      // a bit hacky, consider cleaning this up, need to work through all observers though
      const context = $.extend({}, this.get('searchContext'));
      context.type = value;
      this.set('searchContext', context);
    }
    return this.get('searchContext.type');
  }.property('searchContext'),

  contextChanged: function(){
    if (this.get('searchContextEnabled')) {
      _dontSearch = true;
      this.set('searchContextEnabled', false);
      _dontSearch = false;
    }
  }.observes('searchContext'),

  fullSearchUrlRelative: function(){

    if (this.get('searchContextEnabled') && this.get('searchContext.type') === 'topic') {
      return null;
    }

    let url = '/search?q=' + encodeURIComponent(this.get('term'));
    const searchContext = this.get('searchContext');

    if (this.get('searchContextEnabled') && searchContext) {
      url += encodeURIComponent(" " + searchContext.type + ":" + searchContext.id);
    }

    return url;

  }.property('searchContext','term','searchContextEnabled'),

  fullSearchUrl: function(){
    const url = this.get('fullSearchUrlRelative');
    if (url) {
      return Discourse.getURL(url);
    }
  }.property('fullSearchUrlRelative'),

  searchContextDescription: function(){
    const ctx = this.get('searchContext');
    if (ctx) {
      switch(Em.get(ctx, 'type')) {
        case 'topic':
          return I18n.t('search.context.topic');
        case 'user':
          return I18n.t('search.context.user', {username: Em.get(ctx, 'user.username')});
        case 'category':
          return I18n.t('search.context.category', {category: Em.get(ctx, 'category.name')});
        case 'private_messages':
          return I18n.t('search.context.private_messages');
      }
    }
  }.property('searchContext'),

  searchContextEnabledChanged: function(){
    if (_dontSearch) { return; }
    this.newSearchNeeded();
  }.observes('searchContextEnabled'),

  // If we need to perform another search
  newSearchNeeded: function() {
    this.set('noResults', false);
    const term = (this.get('term') || '').trim();
    if (term.length >= Discourse.SiteSettings.min_search_term_length) {
      this.set('loading', true);

      Ember.run.debounce(this, 'searchTerm', term, this.get('typeFilter'), 400);
    } else {
      this.setProperties({ content: null });
    }
    this.set('selectedIndex', 0);
  }.observes('term', 'typeFilter'),

  searchTerm(term, typeFilter) {
    const self = this;

    // for cancelling debounced search
    if (this._cancelSearch){
      this._cancelSearch = null;
      return;
    }

    if (this._search) {
      this._search.abort();
    }

    const searchContext = this.get('searchContextEnabled') ? this.get('searchContext') : null;

    this._search = searchForTerm(term, {
      typeFilter,
      searchContext,
      fullSearchUrl: this.get('fullSearchUrl')
    });

    this._search.then(function(results) {
      self.setProperties({ noResults: !results, content: results });
    }).finally(function() {
      self.set('loading', false);
      self._search = null;
    });
  },

  showCancelFilter: function() {
    if (this.get('loading')) return false;
    return this.present('typeFilter');
  }.property('typeFilter', 'loading'),

  termChanged: function() {
    this.cancelTypeFilter();
  }.observes('term'),

  actions: {
    fullSearch() {
      const self = this;

      if (this._search) {
        this._search.abort();
      }

      // maybe we are debounced and delayed
      // stop that as well
      this._cancelSearch = true;
      Em.run.later(function(){
        self._cancelSearch = false;
      }, 400);

      const url = this.get('fullSearchUrlRelative');
      if (url) {
        Discourse.URL.routeTo(url);
      }
    },

    moreOfType(type) {
      this.set('typeFilter', type);
    },

    cancelType() {
      this.cancelTypeFilter();
    }
  },

  cancelTypeFilter() {
    this.set('typeFilter', null);
  }
});
