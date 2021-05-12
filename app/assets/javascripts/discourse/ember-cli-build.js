"use strict";

const EmberApp = require("ember-cli/lib/broccoli/ember-app");
const resolve = require("path").resolve;
const mergeTrees = require("broccoli-merge-trees");
const concat = require("broccoli-concat");
const prettyTextEngine = require("./lib/pretty-text-engine");
const { createI18nTree } = require("./lib/translation-plugin");
const discourseScss = require("./lib/discourse-scss");
const funnel = require("broccoli-funnel");
const AssetRev = require("broccoli-asset-rev");

module.exports = function (defaults) {
  let discourseRoot = resolve("../../../..");
  let vendorJs = discourseRoot + "/vendor/assets/javascripts/";

  let app = new EmberApp(defaults, {
    autoRun: false,
    "ember-qunit": {
      insertContentForTestBody: false,
    },
  });

  // Ember CLI does this by default for the app tree, but for our extra bundles we
  // need to do it ourselves in production mode.
  const isProduction = EmberApp.env().includes("production");
  function digest(tree) {
    return isProduction ? new AssetRev(tree) : tree;
  }

  // WARNING: We should only import scripts here if they are not in NPM.
  // For example: our very specific version of bootstrap-modal.
  app.import(vendorJs + "bootbox.js");
  app.import(vendorJs + "bootstrap-modal.js");
  app.import(vendorJs + "jquery.ui.widget.js");
  app.import(vendorJs + "jquery.fileupload.js");
  app.import(vendorJs + "jquery.autoellipsis-1.0.10.js");

  let adminVendor = funnel(vendorJs, {
    files: ["resumable.js"],
  });

  return mergeTrees([
    discourseScss(`${discourseRoot}/app/assets/stylesheets`, "testem.scss"),
    createI18nTree(discourseRoot, vendorJs),
    app.toTree(),
    funnel(`${discourseRoot}/public/javascripts`, { destDir: "javascripts" }),
    funnel(`${vendorJs}/highlightjs`, {
      files: ["highlight-test-bundle.min.js"],
      destDir: "assets/highlightjs",
    }),
    digest(
      concat(mergeTrees([app.options.adminTree, adminVendor]), {
        outputFile: `assets/admin.js`,
      })
    ),
    digest(prettyTextEngine(vendorJs, "discourse-markdown")),
  ]);
};
