/**
  This controller supports actions when listing topics or categories

  @class ListController
  @extends Discourse.Controller
  @namespace Discourse
  @module Discourse
**/
Discourse.ListController = Discourse.Controller.extend({
  categoryBinding: 'topicList.category',
  canCreateCategory: false,
  canCreateTopic: false,
  needs: ['composer', 'modal', 'listTopics'],

  availableNavItems: function() {
    var summary = this.get('filterSummary');
    var loggedOn = !!Discourse.User.current();
    return Discourse.SiteSettings.top_menu.split("|").map(function(i) {
      return Discourse.NavItem.fromText(i, {
        loggedOn: loggedOn,
        countSummary: summary
      });
    }).filter(function(i) {
      return i !== null;
    });
  }.property('filterSummary'),

  /**
    Load a list based on a filter

    @method load
    @param {String} filterMode the filter we want to load
    @returns {Ember.Deferred} the promise that will resolve to the list of items.
  **/
  load: function(filterMode) {
    var listController = this;
    this.set('loading', true);

    if (filterMode === 'categories') {
      return Discourse.CategoryList.list(filterMode).then(function(items) {
        listController.setProperties({
          loading: false,
          filterMode: filterMode,
          categoryMode: true,
          draft: items.draft,
          draft_key: items.draft_key,
          draft_sequence: items.draft_sequence
        });
        return items;
      });
    }

    var current = (this.get('availableNavItems').filter(function(f) { return f.name === filterMode; }))[0];
    if (!current) {
      current = Discourse.NavItem.create({ name: filterMode });
    }

    return Discourse.TopicList.list(current).then(function(items) {
      listController.setProperties({
        loading: false,
        filterSummary: items.filter_summary,
        filterMode: filterMode,
        draft: items.draft,
        draft_key: items.draft_key,
        draft_sequence: items.draft_sequence
      })
      return items;
    });
  },

  // Put in the appropriate page title based on our view
  updateTitle: function() {
    if (this.get('filterMode') === 'categories') {
      return Discourse.set('title', Em.String.i18n('categories_list'));
    } else {
      if (this.present('category')) {
        return Discourse.set('title', this.get('category.name').capitalize() + " " + Em.String.i18n('topic.list'));
      } else {
        return Discourse.set('title', Em.String.i18n('topic.list'));
      }
    }
  }.observes('filterMode', 'category'),

  // Create topic button
  createTopic: function() {
    this.get('controllers.composer').open({
      categoryName: this.get('category.name'),
      action: Discourse.Composer.CREATE_TOPIC,
      draft: this.get('draft'),
      draftKey: this.get('draft_key'),
      draftSequence: this.get('draft_sequence')
    });
  },

  createCategory: function() {
    var _ref;
    return (_ref = this.get('controllers.modal')) ? _ref.show(Discourse.EditCategoryView.create()) : void 0;
  },

  canEditCategory: function() {
    if( this.present('category') ) {
      var u = Discourse.User.current();
      return u && u.admin;
    } else {
      return false;
    }
  }.property('category'),

  editCategory: function() {
    this.get('controllers.modal').show(Discourse.EditCategoryView.create({ category: this.get('category') }));
    return false;
  }

});

Discourse.ListController.reopenClass({
  filters: ['latest', 'hot', 'favorited', 'read', 'unread', 'new', 'posted']
});
