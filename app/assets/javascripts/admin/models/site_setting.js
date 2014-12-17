Discourse.SiteSetting = Discourse.Model.extend({

  validationMessage: null,

  /**
    Is the boolean setting true?

    @property enabled
  **/
  enabled: function(key, value) {

    if (arguments.length > 1) {
      this.set('value', value ? 'true' : 'false');
    }

    if (this.blank('value')) return false;
    return this.get('value') === 'true';

  }.property('value'),

  /**
    The name of the setting. Basically, underscores in the setting key are replaced with spaces.

    @property settingName
  **/
  settingName: function() {
    return this.get('setting').replace(/\_/g, ' ');
  }.property('setting'),

  /**
    Has the user changed the setting? If so we should save it.

    @property dirty
  **/
  dirty: function() {
    return this.get('originalValue') !== this.get('value');
  }.property('originalValue', 'value'),

  overridden: function() {
    var val = this.get('value'),
        defaultVal = this.get('default');

    if (val === null) val = '';
    if (defaultVal === null) defaultVal = '';

    return val.toString() !== defaultVal.toString();
  }.property('value', 'default'),

  /**
    Reset the setting to its original value.

    @method resetValue
  **/
  resetValue: function() {
    this.set('value', this.get('originalValue'));
    this.set('validationMessage', null);
  },

  /**
    Save the setting's value.

    @method save
  **/
  save: function() {
    // Update the setting
    var self = this, data = {};
    data[this.get('setting')] = this.get('value');
    return Discourse.ajax("/admin/site_settings/" + this.get('setting'), {
      data: data,
      type: 'PUT'
    }).then(function() {
      self.set('originalValue', self.get('value'));
      self.set('validationMessage', null);
    }, function(e) {
      if (e.responseJSON && e.responseJSON.errors) {
        self.set('validationMessage', e.responseJSON.errors[0]);
      } else {
        self.set('validationMessage', I18n.t('generic_error'));
      }
    });
  },

  validValues: function() {
    var vals, setting;
    vals = Em.A();
    setting = this;
    _.each(this.get('valid_values'), function(v) {
      if (v.name && v.name.length > 0) {
        if (setting.translate_names) {
          vals.addObject({name: I18n.t(v.name), value: v.value});
        } else {
          vals.addObject(v);
        }
      }
    });
    return vals;
  }.property('valid_values'),

  allowsNone: function() {
    if ( _.indexOf(this.get('valid_values'), '') >= 0 ) return 'admin.site_settings.none';
  }.property('valid_values')
});

Discourse.SiteSetting.reopenClass({

  findAll: function() {
    return Discourse.ajax("/admin/site_settings").then(function (settings) {
      // Group the results by category
      var categoryNames = [],
          categories = {},
          result = Em.A();
      _.each(settings.site_settings,function(s) {
        s.originalValue = s.value;
        if (!categoryNames.contains(s.category)) {
          categoryNames.pushObject(s.category);
          categories[s.category] = Em.A();
        }
        categories[s.category].pushObject(Discourse.SiteSetting.create(s));
      });
      _.each(categoryNames, function(n) {
        result.pushObject({nameKey: n, name: I18n.t('admin.site_settings.categories.' + n), siteSettings: categories[n]});
      });
      return result;
    });
  },

  update: function(key, value) {
    return Discourse.ajax("/admin/site_settings/" + key, {
      type: 'PUT',
      data: { value: value }
    });
  }

});


