/*global Favcount:true*/
var DiscourseResolver = require('discourse/ember/resolver').default;

// Allow us to import Ember
define('ember', ['exports'], function(__exports__) {
  __exports__.default = Ember;
});

var _pluginCallbacks = [];

window.Discourse = Ember.Application.createWithMixins(Discourse.Ajax, {
  rootElement: '#main',
  _docTitle: document.title,

  getURL: function(url) {
    if (!url) return url;

    // if it's a non relative URL, return it.
    if (url !== '/' && !/^\/[^\/]/.test(url)) return url;

    if (url.indexOf(Discourse.BaseUri) !== -1) return url;
    if (url[0] !== "/") url = "/" + url;

    return Discourse.BaseUri + url;
  },

  getURLWithCDN: function(url) {
    url = this.getURL(url);
    // only relative urls
    if (Discourse.CDN && /^\/[^\/]/.test(url)) {
      url = Discourse.CDN + url;
    } else if (Discourse.S3CDN) {
      url = url.replace(Discourse.S3BaseUrl, Discourse.S3CDN);
    }
    return url;
  },

  Resolver: DiscourseResolver,

  _titleChanged: function() {
    var title = this.get('_docTitle') || Discourse.SiteSettings.title;

    // if we change this we can trigger changes on document.title
    // only set if changed.
    if($('title').text() !== title) {
      $('title').text(title);
    }

    var notifyCount = this.get('notifyCount');
    if (notifyCount > 0 && !Discourse.User.currentProp('dynamic_favicon')) {
      title = "(" + notifyCount + ") " + title;
    }

    document.title = title;
  }.observes('_docTitle', 'hasFocus', 'notifyCount'),

  faviconChanged: function() {
    if(Discourse.User.currentProp('dynamic_favicon')) {
      var url = Discourse.SiteSettings.favicon_url;
      if (/^http/.test(url)) {
        url = Discourse.getURL("/favicon/proxied?" + encodeURIComponent(url));
      }
      new Favcount(url).set(
        this.get('notifyCount')
      );
    }
  }.observes('notifyCount'),

  // The classes of buttons to show on a post
  postButtons: function() {
    return Discourse.SiteSettings.post_menu.split("|").map(function(i) {
      return i.replace(/\+/, '').capitalize();
    });
  }.property(),

  notifyTitle: function(count) {
    this.set('notifyCount', count);
  },

  notifyBackgroundCountIncrement: function() {
    if (!this.get('hasFocus')) {
      this.set('backgroundNotify', true);
      this.set('notifyCount', (this.get('notifyCount') || 0) + 1);
    }
  },

  resetBackgroundNotifyCount: function() {
    if (this.get('hasFocus') && this.get('backgroundNotify')) {
      this.set('notifyCount', 0);
    }
    this.set('backgroundNotify', false);
  }.observes('hasFocus'),

  authenticationComplete: function(options) {
    // TODO, how to dispatch this to the controller without the container?
    var loginController = Discourse.__container__.lookup('controller:login');
    return loginController.authenticationComplete(options);
  },

  /**
    Start up the Discourse application by running all the initializers we've defined.

    @method start
  **/
  start: function() {

    $('noscript').remove();

    Ember.keys(requirejs._eak_seen).forEach(function(key) {
      if (/\/pre\-initializers\//.test(key)) {
        var module = require(key, null, null, true);
        if (!module) { throw new Error(key + ' must export an initializer.'); }
        Discourse.initializer(module.default);
      }
    });

    Ember.keys(requirejs._eak_seen).forEach(function(key) {
      if (/\/initializers\//.test(key)) {
        var module = require(key, null, null, true);
        if (!module) { throw new Error(key + ' must export an initializer.'); }

        var init = module.default;
        var oldInitialize = init.initialize;
        init.initialize = function(app) {
          oldInitialize.call(this, app.container, Discourse);
        };

        Discourse.instanceInitializer(init);
      }
    });

    // Plugins that are registered via `<script>` tags.
    var withPluginApi = require('discourse/lib/plugin-api').withPluginApi;
    var initCount = 0;
    _pluginCallbacks.forEach(function(cb) {
      Discourse.instanceInitializer({
        name: "_discourse_plugin_" + (++initCount),
        after: 'inject-objects',
        initialize: function() {
          withPluginApi(cb.version, cb.code);
        }
      });
    });
  },

  requiresRefresh: function(){
    var desired = Discourse.get("desiredAssetVersion");
    return desired && Discourse.get("currentAssetVersion") !== desired;
  }.property("currentAssetVersion", "desiredAssetVersion"),

  _registerPluginCode: function(version, code) {
    _pluginCallbacks.push({ version: version, code: code });
  },

  assetVersion: Ember.computed({
    get: function() {
      return this.get("currentAssetVersion");
    },
    set: function(key, val) {
      if(val) {
        if (this.get("currentAssetVersion")) {
          this.set("desiredAssetVersion", val);
        } else {
          this.set("currentAssetVersion", val);
        }
      }
      return this.get("currentAssetVersion");
    }
  })
});

function RemovedObject(name) {
  this._removedName = name;
}

function methodMissing() {
  console.warn("The " + this._removedName + " object has been removed from Discourse " +
               "and your plugin needs to be updated.");
};

Discourse.RemovedObject = RemovedObject;

['reopen', 'registerButton', 'on', 'off'].forEach(function(m) { RemovedObject.prototype[m] = methodMissing; });

['discourse/views/post', 'discourse/components/post-menu'].forEach(function(moduleName) {
  define(moduleName, [], function() { return new RemovedObject(moduleName); });
});

