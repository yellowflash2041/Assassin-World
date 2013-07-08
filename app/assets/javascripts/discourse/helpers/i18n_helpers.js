/**
 We always prefix with "js." to select exactly what we want passed
 through to the front end.
**/

var oldI18nlookup = I18n.lookup;
I18n.lookup = function() {
  arguments[0] = "js." + arguments[0];
  return oldI18nlookup.apply(this, arguments);
}

/**
  Look up a translation for an i18n key in our dictionary.

  @method i18n
  @for Handlebars
**/
Ember.Handlebars.registerHelper('i18n', function(property, options) {
  // Resolve any properties
  var params,
    _this = this;
  params = options.hash;
  _.each(params, function(value, key) {
    params[key] = Em.Handlebars.get(_this, value, options);
  });
  return I18n.t(property, params);
});

/**
  Set up an i18n binding that will update as a count changes, complete with pluralization.

  @method countI18n
  @for Handlebars
**/
Ember.Handlebars.registerHelper('countI18n', function(key, options) {
  var view = Discourse.View.extend({
    tagName: 'span',

    render: function(buffer) {
      buffer.push(I18n.t(key, { count: this.get('count') }));
    },

    countChanged: function() {
      this.rerender();
    }.observes('count')

  });
  return Ember.Handlebars.helpers.view.call(this, view, options);
});

if (Ember.EXTEND_PROTOTYPES) {
  String.prototype.i18n = function(options) {
    return I18n.t(String(this), options);
  };
}
