// This bundle contains the same dependencies as app/assets/javascripts/vendor.js
// minus ember_jquery.
// ember_jquery doesn't work with theme tests in production because it
// contains production builds of Ember and jQuery, so we have a separate bundle
// caled theme_qunit_ember_jquery which contains a debug build for Ember and jQuery.
// We don't put theme_qunit_ember_jquery in this bundle because it would make the
// bundle too big and cause OOM exceptions during rebuilds for self-hosters on
// low-end machines.

//= require logster

//= require template_include.js

//= require message-bus
//= require jquery.ui.widget.js
//= require Markdown.Converter.js
//= require bootbox.js
//= require popper.js
//= require bootstrap-modal.js
//= require caret_position
//= require jquery.sortable.js
//= require lodash.js
//= require itsatrap.js
//= require rsvp.js
//= require uppy.js
//= require buffered-proxy
//= require virtual-dom
//= require virtual-dom-amd
//= require discourse-shims
//= require pretty-text-bundle
