import {
  applyPretender,
  exists,
  resetSite,
  testsInitialized,
  testsTornDown,
} from "discourse/tests/helpers/qunit-helpers";
import pretender, {
  applyDefaultHandlers,
  pretenderHelpers,
  resetPretender,
} from "discourse/tests/helpers/create-pretender";
import { resetSettings } from "discourse/tests/helpers/site-settings";
import { setDefaultOwner } from "discourse-common/lib/get-owner";
import { setApplication, setResolver } from "@ember/test-helpers";
import { setupS3CDN, setupURL } from "discourse-common/lib/get-url";
import Application from "../app";
import MessageBus from "message-bus-client";
import PreloadStore from "discourse/lib/preload-store";
import { resetSettings as resetThemeSettings } from "discourse/lib/theme-settings-store";
import QUnit from "qunit";
import { ScrollingDOMMethods } from "discourse/mixins/scrolling";
import Session from "discourse/models/session";
import User from "discourse/models/user";
import Site from "discourse/models/site";
import bootbox from "bootbox";
import { buildResolver } from "discourse-common/resolver";
import { createHelperContext } from "discourse-common/lib/helpers";
import deprecated from "discourse-common/lib/deprecated";
import { flushMap } from "discourse/services/store";
import sinon from "sinon";
import { disableCloaking } from "discourse/widgets/post-stream";
import { clearState as clearPresenceState } from "discourse/tests/helpers/presence-pretender";
import { addModuleExcludeMatcher } from "ember-cli-test-loader/test-support/index";
import SiteSettingService from "discourse/services/site-settings";

const Plugin = $.fn.modal;
const Modal = Plugin.Constructor;

function AcceptanceModal(option, _relatedTarget) {
  return this.each(function () {
    let $this = $(this);
    let data = $this.data("bs.modal");
    let options = Object.assign(
      {},
      Modal.DEFAULTS,
      $this.data(),
      typeof option === "object" && option
    );

    if (!data) {
      $this.data("bs.modal", (data = new Modal(this, options)));
    }
    data.$body = $("#ember-testing");

    if (typeof option === "string") {
      data[option](_relatedTarget);
    } else if (options.show) {
      data.show(_relatedTarget);
    }
  });
}

let started = false;

function createApplication(config, settings) {
  const app = Application.create(config);

  app.injectTestHelpers();
  setApplication(app);
  setResolver(buildResolver("discourse").create({ namespace: app }));

  // Modern Ember only sets up a container when the ApplicationInstance
  // is booted. We have legacy code which relies on having access to a container
  // before boot (e.g. during pre-initializers)
  //
  // This hack sets up a container early, then stubs the container setup method
  // so that Ember will use the same container instance when it boots the ApplicationInstance
  //
  // Note that this hack is not required in production because we use the default `autoboot` flag,
  // which triggers the internal `_globalsMode` flag, which sets up an ApplicationInstance immediately when
  // an Application is initialized (via the `_buildDeprecatedInstance` method).
  //
  // In the future, we should move away from relying on the `container` before the ApplicationInstance
  // is booted, and then remove this hack.
  let container = app.__registry__.container();
  app.__container__ = container;
  setDefaultOwner(container);
  sinon
    .stub(Object.getPrototypeOf(app.__registry__), "container")
    .callsFake((opts) => {
      container.owner = opts.owner;
      container.registry = opts.owner.__registry__;
      return container;
    });

  SiteSettingService.create = () => settings;

  if (!started) {
    app.instanceInitializer({
      name: "test-helper",
      initialize: testsInitialized,
      teardown: testsTornDown,
    });

    app.start();
    started = true;
  }

  return app;
}

function setupToolbar() {
  // Most default toolbar items aren't useful for Discourse
  QUnit.config.urlConfig = QUnit.config.urlConfig.reject((c) =>
    ["noglobals", "nolint", "devmode", "dockcontainer", "nocontainer"].includes(
      c.id
    )
  );

  QUnit.config.urlConfig.push({
    id: "qunit_skip_core",
    label: "Skip Core",
    value: "1",
  });

  QUnit.config.urlConfig.push({
    id: "qunit_skip_plugins",
    label: "Skip Plugins",
    value: "1",
  });

  const pluginNames = new Set();

  Object.keys(requirejs.entries).forEach((moduleName) => {
    const found = moduleName.match(/\/plugins\/([\w-]+)\//);
    if (found && moduleName.match(/\-test/)) {
      pluginNames.add(found[1]);
    }
  });

  QUnit.config.urlConfig.push({
    id: "qunit_single_plugin",
    label: "Plugin",
    value: Array.from(pluginNames),
  });
}

function reportMemoryUsageAfterTests() {
  QUnit.done(() => {
    const usageBytes = performance.memory?.usedJSHeapSize;
    let result;
    if (usageBytes) {
      result = `${(usageBytes / Math.pow(2, 30)).toFixed(3)}GB`;
    } else {
      result = "(performance.memory api unavailable)";
    }

    writeSummaryLine(`Used JS Heap Size: ${result}`);
  });
}

function writeSummaryLine(message) {
  // eslint-disable-next-line no-console
  console.log(`\n${message}\n`);
  if (window.Testem) {
    window.Testem.useCustomAdapter(function (socket) {
      socket.emit("test-metadata", "summary-line", {
        message,
      });
    });
  }
}

export default function setupTests(config) {
  disableCloaking();

  QUnit.config.hidepassed = true;

  sinon.config = {
    injectIntoThis: false,
    injectInto: null,
    properties: ["spy", "stub", "mock", "clock", "sandbox"],
    useFakeTimers: true,
    useFakeServer: false,
  };

  // Stop the message bus so we don't get ajax calls
  MessageBus.stop();

  // disable logster error reporting
  if (window.Logster) {
    window.Logster.enabled = false;
  } else {
    window.Logster = { enabled: false };
  }

  $.fn.modal = AcceptanceModal;

  Object.defineProperty(window, "exists", {
    get() {
      deprecated(
        "Accessing the global function `exists` is deprecated. Import it instead.",
        {
          since: "2.6.0.beta.4",
          dropFrom: "2.6.0",
        }
      );
      return exists;
    },
  });

  let setupData;
  const setupDataElement = document.getElementById("data-discourse-setup");
  if (setupDataElement) {
    setupData = setupDataElement.dataset;
    setupDataElement.remove();
  }

  QUnit.testStart(function (ctx) {
    bootbox.$body = $("#ember-testing");
    let settings = resetSettings();
    resetThemeSettings();

    const app = createApplication(config, settings);

    const cdn = setupData ? setupData.cdn : null;
    const baseUri = setupData ? setupData.baseUri : "";
    setupURL(cdn, "http://localhost:3000", baseUri, { snapshot: true });
    if (setupData && setupData.s3BaseUrl) {
      setupS3CDN(setupData.s3BaseUrl, setupData.s3Cdn, { snapshot: true });
    } else {
      setupS3CDN(null, null, { snapshot: true });
    }

    applyDefaultHandlers(pretender);

    pretender.prepareBody = function (body) {
      if (typeof body === "object") {
        return JSON.stringify(body);
      }
      return body;
    };

    if (QUnit.config.logAllRequests) {
      pretender.handledRequest = function (verb, path) {
        // eslint-disable-next-line no-console
        console.log("REQ: " + verb + " " + path);
      };
    }

    pretender.unhandledRequest = function (verb, path) {
      if (QUnit.config.logAllRequests) {
        // eslint-disable-next-line no-console
        console.log("REQ: " + verb + " " + path + " missing");
      }

      const error =
        "Unhandled request in test environment: " + path + " (" + verb + ")";

      // eslint-disable-next-line no-console
      console.error(error);
      throw new Error(error);
    };

    pretender.checkPassthrough = (request) =>
      request.requestHeaders["Discourse-Script"];

    applyPretender(ctx.module, pretender, pretenderHelpers());

    Session.resetCurrent();
    if (setupData) {
      const session = Session.current();
      session.markdownItURL = setupData.markdownItUrl;
      session.highlightJsPath = setupData.highlightJsPath;
    }
    User.resetCurrent();

    createHelperContext({
      get siteSettings() {
        return app.__container__.lookup("service:site-settings");
      },
      capabilities: {},
      get site() {
        return app.__container__.lookup("service:site") || Site.current();
      },
      registry: app.__registry__,
    });

    PreloadStore.reset();
    resetSite(settings);

    sinon.stub(ScrollingDOMMethods, "screenNotFull");
    sinon.stub(ScrollingDOMMethods, "bindOnScroll");
    sinon.stub(ScrollingDOMMethods, "unbindOnScroll");
  });

  QUnit.testDone(function () {
    sinon.restore();
    resetPretender();
    clearPresenceState();

    // Clean up the DOM. Some tests might leave extra classes or elements behind.
    Array.from(document.getElementsByClassName("modal-backdrop")).forEach((e) =>
      e.remove()
    );
    document.body.removeAttribute("class");
    let html = document.documentElement;
    html.removeAttribute("class");
    html.removeAttribute("style");
    let testing = document.getElementById("ember-testing");
    testing.removeAttribute("class");
    testing.removeAttribute("style");

    const testContainer = document.getElementById("ember-testing-container");
    testContainer.scrollTop = 0;
    testContainer.scrollLeft = 0;

    flushMap();

    MessageBus.unsubscribe("*");
  });

  if (getUrlParameter("qunit_disable_auto_start") === "1") {
    QUnit.config.autostart = false;
  }

  let skipCore =
    getUrlParameter("qunit_single_plugin") ||
    getUrlParameter("qunit_skip_core") === "1";

  let singlePlugin = getUrlParameter("qunit_single_plugin");
  let skipPlugins = !singlePlugin && getUrlParameter("qunit_skip_plugins");

  if (skipCore && !getUrlParameter("qunit_skip_core")) {
    replaceUrlParameter("qunit_skip_core", "1");
  }

  if (!skipPlugins && getUrlParameter("qunit_skip_plugins")) {
    replaceUrlParameter("qunit_skip_plugins", null);
  }

  const shouldLoadModule = (name) => {
    if (!/\-test/.test(name)) {
      return false;
    }

    const isPlugin = name.match(/\/plugins\//);
    const isCore = !isPlugin;
    const pluginName = name.match(/\/plugins\/([\w-]+)\//)?.[1];

    if (skipCore && isCore) {
      return false;
    } else if (skipPlugins && isPlugin) {
      return false;
    } else if (singlePlugin && singlePlugin !== pluginName) {
      return false;
    }
    return true;
  };

  addModuleExcludeMatcher((name) => !shouldLoadModule(name));

  // forces 0 as duration for all jquery animations
  // eslint-disable-next-line no-undef
  jQuery.fx.off = true;

  setupToolbar();
  reportMemoryUsageAfterTests();
}

function getUrlParameter(name) {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.get(name);
}

function replaceUrlParameter(name, value) {
  const queryParams = new URLSearchParams(window.location.search);
  if (value === null) {
    queryParams.delete(name);
  } else {
    queryParams.set(name, value);
  }
  history.replaceState(null, null, "?" + queryParams.toString());

  QUnit.begin(() => {
    QUnit.config[name] = value;
    const formElement = document.querySelector(
      `#qunit-testrunner-toolbar [name=${name}]`
    );
    if (formElement?.type === "checkbox") {
      formElement.checked = !!value;
    } else if (formElement) {
      formElement.value = value;
    }
  });
}
