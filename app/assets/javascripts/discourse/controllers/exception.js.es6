
var ButtonBackBright = {
      classes: "btn-primary",
      action: "back",
      key: "errors.buttons.back"
    },
    ButtonBackDim = {
      classes: "",
      action: "back",
      key: "errors.buttons.back"
    },
    ButtonTryAgain = {
      classes: "btn-primary",
      action: "tryLoading",
      key: "errors.buttons.again"
    },
    ButtonLoadPage = {
      classes: "btn-primary",
      action: "tryLoading",
      key: "errors.buttons.fixed"
    };

/**
  The controller for the nice error page

  @class ExceptionController
  @extends Discourse.ObjectController
  @namespace Discourse
  @module Discourse
**/
export default Discourse.ObjectController.extend({
  thrown: null,
  lastTransition: null,

  isNetwork: function() {
    // never made it on the wire
    if (this.get('thrown.readyState') === 0) return true;
    // timed out
    if (this.get('thrown.jqTextStatus') === "timeout") return true;
    return false;
  }.property(),
  isServer: Em.computed.gte('thrown.status', 500),
  isUnknown: Em.computed.none('isNetwork', 'isServer'),

  // TODO
  // make ajax requests to /srv/status with exponential backoff
  // if one succeeds, set networkFixed to true, which puts a "Fixed!" message on the page
  networkFixed: false,
  loading: false,

  _init: function() {
    this.set('loading', false);
  }.on('init'),

  reason: function() {
    if (this.get('isNetwork')) {
      return I18n.t('errors.reasons.network');
    } else if (this.get('isServer')) {
      return I18n.t('errors.reasons.server');
    } else {
      // TODO
      return I18n.t('errors.reasons.unknown');
    }
  }.property('isNetwork', 'isServer', 'isUnknown'),

  requestUrl: Em.computed.alias('thrown.requestedUrl'),

  desc: function() {
    if (this.get('networkFixed')) {
      return I18n.t('errors.desc.network_fixed');
    } else if (this.get('isNetwork')) {
      return I18n.t('errors.desc.network');
    } else if (this.get('isServer')) {
      return I18n.t('errors.desc.server', this.get('thrown.statusText'));
    } else {
      // TODO
      return I18n.t('errors.desc.unknown');
    }
  }.property('networkFixed', 'isNetwork', 'isServer', 'isUnknown'),

  enabledButtons: function() {
    if (this.get('networkFixed')) {
      return [ButtonLoadPage];
    } else if (this.get('isNetwork')) {
      return [ButtonBackDim, ButtonTryAgain];
    } else if (this.get('isServer')) {
      return [ButtonBackBright];
    } else {
      return [ButtonBackBright, ButtonTryAgain];
    }
  }.property('networkFixed', 'isNetwork', 'isServer', 'isUnknown'),

  actions: {
    back: function() {
      window.history.back();
    },

    tryLoading: function() {
      this.set('loading', true);
      var self = this;
      Em.run.schedule('afterRender', function() {
        self.get('lastTransition').retry();
        self.set('loading', false);
      });
    }
  }
});
