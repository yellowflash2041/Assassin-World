// A helper to build a topic route for a filter

export var queryParams = {
  sort: { replace: true },
  ascending: { replace: true },
  status: { replace: true },
  state: { replace: true },
  search: { replace: true }
};

export function filterQueryParams(params, defaultParams) {
  var findOpts = defaultParams || {};
  if (params) {
    Ember.keys(queryParams).forEach(function(opt) {
      if (params[opt]) { findOpts[opt] = params[opt]; }
    });
  }
  return findOpts;
}

export default function(filter) {
  return Discourse.Route.extend({
    queryParams: queryParams,

    beforeModel: function() {
      this.controllerFor('navigation/default').set('filterMode', filter);
    },

    model: function(data, transaction) {

      // attempt to stop early cause we need this to be called before .sync
      Discourse.ScreenTrack.current().stop();

      var findOpts = filterQueryParams(transaction.queryParams);
      return Discourse.TopicList.list(filter, findOpts).then(function(list) {
        var tracking = Discourse.TopicTrackingState.current();
        if (tracking) {
          tracking.sync(list, filter);
          tracking.trackIncoming(filter);
        }
        return list;
      });
    },

    setupController: function(controller, model, trans) {

      controller.setProperties(Em.getProperties(trans, _.keys(queryParams).map(function(v){
        return 'queryParams.' + v;
      })));

      var period = filter.indexOf('/') > 0 ? filter.split('/')[1] : '',
          filterText = I18n.t('filters.' + filter.replace('/', '.') + '.title', {count: 0});

      if (filter === Discourse.Utilities.defaultHomepage()) {
        Discourse.set('title', '');
      } else {
        Discourse.set('title', I18n.t('filters.with_topics', {filter: filterText}));
      }

      this.controllerFor('discovery/topics').setProperties({
        model: model,
        category: null,
        period: period,
        selected: []
      });

      this.openTopicDraft(model);

      this.controllerFor('navigation/default').set('canCreateTopic', model.get('can_create_topic'));
    },

    renderTemplate: function() {
      this.render('navigation/default', { outlet: 'navigation-bar' });
      this.render('discovery/topics', { controller: 'discovery/topics', outlet: 'list-container' });
    }
  });
}

