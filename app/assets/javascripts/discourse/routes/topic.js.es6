var isTransitioning = false,
    scheduledReplace = null,
    lastScrollPos = null,
    SCROLL_DELAY = 500;

import ShowFooter from "discourse/mixins/show-footer";
import Topic from 'discourse/models/topic';

var TopicRoute = Discourse.Route.extend(ShowFooter, {
  redirect() { return this.redirectIfLoginRequired(); },

  queryParams: {
    filter: { replace: true },
    username_filters: { replace: true },
    show_deleted: { replace: true }
  },

  titleToken() {
    var model = this.modelFor('topic');
    if (model) {
      var result = model.get('title'),
          cat = model.get('category');

      // Only display uncategorized in the title tag if it was renamed
      if (cat && !(cat.get('isUncategorizedCategory') && cat.get('name').toLowerCase() === "uncategorized")) {
        var catName = cat.get('name'),
            parentCategory = cat.get('parentCategory');

        if (parentCategory) {
          catName = parentCategory.get('name') + " / " + catName;
        }

        return [result, catName];
      }
      return result;
    }
  },

  actions: {

    showTopicAdminMenu() {
      this.controllerFor("topic-admin-menu").send("show");
    },

    showFlags(post) {
      Discourse.Route.showModal(this, 'flag', post);
      this.controllerFor('flag').setProperties({ selected: null });
    },

    showFlagTopic(topic) {
      Discourse.Route.showModal(this, 'flag', topic);
      this.controllerFor('flag').setProperties({ selected: null, flagTopic: true });
    },

    showAutoClose() {
      Discourse.Route.showModal(this, 'editTopicAutoClose', this.modelFor('topic'));
      this.controllerFor('modal').set('modalClass', 'edit-auto-close-modal');
    },

    showInvite() {
      Discourse.Route.showModal(this, 'invite', this.modelFor('topic'));
      this.controllerFor('invite').reset();
    },

    showPrivateInvite() {
      Discourse.Route.showModal(this, 'invitePrivate', this.modelFor('topic'));
      this.controllerFor('invitePrivate').setProperties({
        email: null,
        error: false,
        saving: false,
        finished: false
      });
    },

    showHistory(post) {
      Discourse.Route.showModal(this, 'history', post);
      this.controllerFor('history').refresh(post.get("id"), "latest");
      this.controllerFor('modal').set('modalClass', 'history-modal');
    },

    showRawEmail(post) {
      Discourse.Route.showModal(this, 'raw-email', post);
      this.controllerFor('raw_email').loadRawEmail(post.get("id"));
    },

    mergeTopic() {
      Discourse.Route.showModal(this, 'mergeTopic', this.modelFor('topic'));
    },

    splitTopic() {
      Discourse.Route.showModal(this, 'split-topic', this.modelFor('topic'));
    },

    changeOwner() {
      Discourse.Route.showModal(this, 'changeOwner', this.modelFor('topic'));
    },

    // Use replaceState to update the URL once it changes
    postChangedRoute(currentPost) {
      // do nothing if we are transitioning to another route
      if (isTransitioning || Discourse.TopicRoute.disableReplaceState) { return; }

      var topic = this.modelFor('topic');
      if (topic && currentPost) {
        var postUrl = topic.get('url');
        if (currentPost > 1) { postUrl += "/" + currentPost; }

        Em.run.cancel(scheduledReplace);
        lastScrollPos = parseInt($(document).scrollTop(), 10);
        scheduledReplace = Em.run.later(this, '_replaceUnlessScrolling', postUrl, SCROLL_DELAY);
      }
    },

    didTransition() {
      this.controllerFor("topic")._showFooter();
      return true;
    },

    willTransition() {
      this._super();
      this.controllerFor("quote-button").deselectText();
      Em.run.cancel(scheduledReplace);
      isTransitioning = true;
      return true;
    }
  },

  // replaceState can be very slow on Android Chrome. This function debounces replaceState
  // within a topic until scrolling stops
  _replaceUnlessScrolling(url) {
    var currentPos = parseInt($(document).scrollTop(), 10);
    if (currentPos === lastScrollPos) {
      Discourse.URL.replaceState(url);
      return;
    }
    lastScrollPos = currentPos;
    scheduledReplace = Em.run.later(this, '_replaceUnlessScrolling', url, SCROLL_DELAY);
  },

  setupParams(topic, params) {
    var postStream = topic.get('postStream');
    postStream.set('summary', Em.get(params, 'filter') === 'summary');
    postStream.set('show_deleted', !!Em.get(params, 'show_deleted'));

    var usernames = Em.get(params, 'username_filters'),
        userFilters = postStream.get('userFilters');

    userFilters.clear();
    if (!Em.isEmpty(usernames) && usernames !== 'undefined') {
      userFilters.addObjects(usernames.split(','));
    }

    return topic;
  },

  model(params, transition) {
    var queryParams = transition.queryParams;

    var topic = this.modelFor('topic');
    if (topic && (topic.get('id') === parseInt(params.id, 10))) {
      this.setupParams(topic, queryParams);
      // If we have the existing model, refresh it
      return topic.get('postStream').refresh().then(function() {
        return topic;
      });
    } else {
      return this.setupParams(Topic.create(_.omit(params, 'username_filters', 'filter')), queryParams);
    }
  },

  activate() {
    this._super();
    isTransitioning = false;

    var topic = this.modelFor('topic');
    this.session.set('lastTopicIdViewed', parseInt(topic.get('id'), 10));
    this.controllerFor('search').set('searchContext', topic.get('searchContext'));
  },

  deactivate() {
    this._super();

    // Clear the search context
    this.controllerFor('search').set('searchContext', null);
    this.controllerFor('user-card').set('visible', false);

    var topicController = this.controllerFor('topic'),
        postStream = topicController.get('postStream');
    postStream.cancelFilter();

    topicController.set('multiSelect', false);
    topicController.unsubscribe();
    this.controllerFor('composer').set('topic', null);
    Discourse.ScreenTrack.current().stop();

    var headerController;
    if (headerController = this.controllerFor('header')) {
      headerController.set('topic', null);
      headerController.set('showExtraInfo', false);
    }
  },

  setupController(controller, model) {
    // In case we navigate from one topic directly to another
    isTransitioning = false;

    if (Discourse.Mobile.mobileView) {
      // close the dropdowns on mobile
      $('.d-dropdown').hide();
      $('header ul.icons li').removeClass('active');
      $('[data-toggle="dropdown"]').parent().removeClass('open');
    }

    controller.setProperties({
      model: model,
      editingTopic: false
    });

    Discourse.TopicRoute.trigger('setupTopicController', this);

    this.controllerFor('header').setProperties({
      topic: model,
      showExtraInfo: false
    });

    this.controllerFor('topic-admin-menu').set('model', model);

    this.controllerFor('composer').set('topic', model);
    Discourse.TopicTrackingState.current().trackIncoming('all');
    controller.subscribe();

    this.controllerFor('topic-progress').set('model', model);
    // We reset screen tracking every time a topic is entered
    Discourse.ScreenTrack.current().start(model.get('id'), controller);
  }

});

RSVP.EventTarget.mixin(TopicRoute);
export default TopicRoute;
