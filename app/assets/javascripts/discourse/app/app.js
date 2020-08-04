/*global Mousetrap:true*/
import Application from "@ember/application";
import { computed } from "@ember/object";
import { buildResolver } from "discourse-common/resolver";
import discourseComputed from "discourse-common/utils/decorators";
import { default as getURL, getURLWithCDN } from "discourse-common/lib/get-url";
import deprecated from "discourse-common/lib/deprecated";

const _pluginCallbacks = [];

const Discourse = Application.extend({
  rootElement: "#main",
  __widget_helpers: {},

  customEvents: {
    paste: "paste"
  },

  reset() {
    this._super(...arguments);
    Mousetrap.reset();
  },

  getURL(url) {
    deprecated(
      "Import `getURL` from `discourse-common/lib/get-url` instead of `Discourse.getURL`",
      { since: "2.5", dropFrom: "2.6" }
    );
    return getURL(url);
  },

  getURLWithCDN(url) {
    deprecated(
      "Import `getURLWithCDN` from `discourse-common/lib/get-url` instead of `Discourse.getURLWithCDN`",
      { since: "2.5", dropFrom: "2.6" }
    );
    return getURLWithCDN(url);
  },

  Resolver: buildResolver("discourse"),

  authenticationComplete(options) {
    // TODO, how to dispatch this to the controller without the container?
    const loginController = this.__container__.lookup("controller:login");
    return loginController.authenticationComplete(options);
  },

  _prepareInitializer(moduleName) {
    const module = requirejs(moduleName, null, null, true);
    if (!module) {
      throw new Error(moduleName + " must export an initializer.");
    }

    const init = module.default;
    const oldInitialize = init.initialize;
    init.initialize = () => oldInitialize.call(init, this.__container__, this);
    return init;
  },

  // Start up the Discourse application by running all the initializers we've defined.
  start() {
    $("noscript").remove();

    Object.keys(requirejs._eak_seen).forEach(key => {
      if (/\/pre\-initializers\//.test(key)) {
        this.initializer(this._prepareInitializer(key));
      } else if (/\/initializers\//.test(key)) {
        this.instanceInitializer(this._prepareInitializer(key));
      }
    });

    // Plugins that are registered via `<script>` tags.
    const withPluginApi = requirejs("discourse/lib/plugin-api").withPluginApi;
    let initCount = 0;
    _pluginCallbacks.forEach(cb => {
      this.instanceInitializer({
        name: `_discourse_plugin_${++initCount}`,
        after: "inject-objects",
        initialize: () => withPluginApi(cb.version, cb.code)
      });
    });
  },

  @discourseComputed("currentAssetVersion", "desiredAssetVersion")
  requiresRefresh(currentAssetVersion, desiredAssetVersion) {
    return desiredAssetVersion && currentAssetVersion !== desiredAssetVersion;
  },

  _registerPluginCode(version, code) {
    _pluginCallbacks.push({ version, code });
  },

  assetVersion: computed({
    get() {
      return this.currentAssetVersion;
    },
    set(key, val) {
      if (val) {
        if (this.currentAssetVersion) {
          this.set("desiredAssetVersion", val);
        } else {
          this.set("currentAssetVersion", val);
        }
      }
      return this.currentAssetVersion;
    }
  })
});

export default Discourse;
