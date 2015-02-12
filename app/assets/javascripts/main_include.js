//= require ./discourse/mixins/ajax
//= require ./discourse

// Pagedown customizations
//= require ./pagedown_custom.js

// This is a BUG we should fix
// it is only required here cause preview is not loading it using LAB
//= require highlight.pack.js
//

// Stuff we need to load first
//= require ./discourse/lib/app-events
//= require ./discourse/helpers/i18n
//= require ./discourse/helpers/fa-icon
//= require ./discourse/lib/ember_compat_handlebars
//= require ./discourse/lib/computed
//= require ./discourse/helpers/register-unbound
//= require ./discourse/mixins/scrolling
//= require_tree ./discourse/mixins
//= require ./discourse/lib/markdown
//= require ./discourse/lib/search-for-term
//= require ./discourse/lib/user-search
//= require ./discourse/lib/autocomplete
//= require ./discourse/lib/after-transition
//= require ./discourse/lib/debounce
//= require_tree ./discourse/adapters
//= require ./discourse/models/model
//= require ./discourse/models/user_action
//= require ./discourse/models/composer
//= require ./discourse/models/post-stream
//= require ./discourse/models/topic-details
//= require ./discourse/models/topic
//= require ./discourse/models/top-period
//= require ./discourse/controllers/controller
//= require ./discourse/controllers/discovery-sortable
//= require ./discourse/controllers/object
//= require ./discourse/controllers/navigation/default
//= require ./discourse/views/view
//= require ./discourse/views/container
//= require ./discourse/views/modal_body_view
//= require ./discourse/views/flag
//= require ./discourse/views/combo-box
//= require ./discourse/views/button
//= require ./discourse/views/dropdown-button
//= require ./discourse/views/notifications-button
//= require ./discourse/views/topic-notifications-button
//= require ./discourse/views/pagedown-preview
//= require ./discourse/views/composer
//= require ./discourse/routes/discourse_route
//= require ./discourse/routes/build-topic-route
//= require ./discourse/routes/restricted-user
//= require ./discourse/routes/user-topic-list
//= require ./discourse/routes/user-activity-stream
//= require ./discourse/routes/topic-from-params
//= require ./discourse/components/top-title
//= require ./discourse/components/text-field
//= require ./discourse/components/visible
//= require ./discourse/components/conditional-loading-spinner
//= require ./discourse/helpers/user-avatar
//= require ./discourse/helpers/cold-age-class
//= require ./discourse/helpers/loading-spinner
//= require ./discourse/helpers/category-link
//= require ./discourse/lib/export-result
//= require ./discourse/dialects/dialect
//= require ./discourse/lib/emoji/emoji
//= require ./discourse/lib/sharing

//= require_tree ./discourse/dialects
//= require_tree ./discourse/controllers
//= require_tree ./discourse/lib
//= require_tree ./discourse/models
//= require_tree ./discourse/components
//= require_tree ./discourse/views
//= require_tree ./discourse/helpers
//= require_tree ./discourse/templates
//= require_tree ./discourse/routes
//= require_tree ./discourse/initializers
