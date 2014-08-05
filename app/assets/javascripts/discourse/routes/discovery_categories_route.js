/**
  The route for handling the "Categories" view

  @class DiscoveryCategoriesRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.DiscoveryCategoriesRoute = Discourse.Route.extend(Discourse.OpenComposer, {
  renderTemplate: function() {
    this.render('navigation/categories', { outlet: 'navigation-bar' });
    this.render('discovery/categories', { outlet: 'list-container' });
  },

  beforeModel: function() {
    this.controllerFor('navigation/categories').set('filterMode', 'categories');
  },

  model: function() {
    // TODO: Remove this and ensure server side does not supply `topic_list`
    // if default page is categories
    PreloadStore.remove("topic_list");

    return Discourse.CategoryList.list('categories').then(function(list) {
      var tracking = Discourse.TopicTrackingState.current();
      if (tracking) {
        tracking.sync(list, 'categories');
        tracking.trackIncoming('categories');
      }
      return list;
    });
  },

  setupController: function(controller, model) {
    controller.set('model', model);
    Discourse.set('title', I18n.t('filters.categories.title'));

    // Only show either the Create Category or Create Topic button
    this.controllerFor('navigation/categories').set('canCreateCategory', model.get('can_create_category'));
    this.controllerFor('navigation/categories').set('canCreateTopic', model.get('can_create_topic') && !model.get('can_create_category'));

    this.openTopicDraft(model);

  },

  actions: {
    createCategory: function() {
      Discourse.Route.showModal(this, 'editCategory', Discourse.Category.create({
        color: 'AB9364', text_color: 'FFFFFF', group_permissions: [{group_name: 'everyone', permission_type: 1}],
        available_groups: Discourse.Site.current().group_names,
        allow_badges: true
      }));
      this.controllerFor('editCategory').set('selectedTab', 'general');
    },

    createTopic: function() {
      this.openComposer(this.controllerFor('discovery/categories'));
    }
  }
});
