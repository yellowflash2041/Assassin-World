import { queryParams } from 'discourse/controllers/discovery-sortable';

// A helper to build a topic route for a filter
function filterQueryParams(params, defaultParams) {
  var findOpts = defaultParams || {};
  if (params) {
    Ember.keys(queryParams).forEach(function(opt) {
      if (params[opt]) { findOpts[opt] = params[opt]; }
    });
  }
  return findOpts;
}

export default function(filter, extras) {
  extras = extras || {};
  return Discourse.Route.extend({
    queryParams: queryParams,

    beforeModel: function() {
      this.controllerFor('navigation/default').set('filterMode', filter);
    },

    model: function(data, transition) {

      // attempt to stop early cause we need this to be called before .sync
      Discourse.ScreenTrack.current().stop();

      var findOpts = filterQueryParams(transition.queryParams),
          extras = { cached: this.isPoppedState(transition) };

      return Discourse.TopicList.list(filter, findOpts, extras);
    },

    titleToken: function() {
      if (filter === Discourse.Utilities.defaultHomepage()) { return; }

      var filterText = I18n.t('filters.' + filter.replace('/', '.') + '.title', {count: 0});
      return I18n.t('filters.with_topics', {filter: filterText});
    },

    setupController: function(controller, model, trans) {
      if (trans) {
        controller.setProperties(Em.getProperties(trans, _.keys(queryParams).map(function(v){
          return 'queryParams.' + v;
        })));
      }

      var periods = this.controllerFor('discovery').get('periods'),
          periodId = model.get('for_period') || (filter.indexOf('/') > 0 ? filter.split('/')[1] : '');

      var topicOpts = {
        model: model,
        category: null,
        period: periods.findBy('id', periodId),
        selected: [],
        expandGloballyPinned: true
      };

      var params = model.get('params');
      if (params && Object.keys(params).length) {
        topicOpts.order = params.order;
        topicOpts.ascending = params.ascending;
      }
      this.controllerFor('discovery/topics').setProperties(topicOpts);

      this.openTopicDraft(model);
      this.controllerFor('navigation/default').set('canCreateTopic', model.get('can_create_topic'));
    },

    renderTemplate: function() {
      this.render('navigation/default', { outlet: 'navigation-bar' });
      this.render('discovery/topics', { controller: 'discovery/topics', outlet: 'list-container' });
    }
  }, extras);
}

export { filterQueryParams };
