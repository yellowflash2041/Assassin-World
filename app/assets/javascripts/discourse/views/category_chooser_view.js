/**
  This view handles rendering of a combobox that can view a category

  @class CategoryChooserView
  @extends Discourse.ComboboxView
  @namespace Discourse
  @module Discourse
**/
Discourse.CategoryChooserView = Discourse.ComboboxView.extend({
  classNames: ['combobox category-combobox'],
  overrideWidths: true,
  dataAttributes: ['name', 'color', 'text_color', 'description_text', 'topic_count', 'read_restricted'],
  valueBinding: Ember.Binding.oneWay('source'),

  content: Em.computed.filter('categories', function(c) {
    var uncategorized_id = Discourse.Site.currentProp("uncategorized_category_id");
    return c.get('permission') === Discourse.PermissionType.FULL && c.get('id') !== uncategorized_id;
  }),

  init: function() {
    this._super();
    if (!this.get('categories')) {
      this.set('categories', Discourse.Category.list());
    }
  },

  none: function() {
    if (Discourse.User.currentProp('staff') || Discourse.SiteSettings.allow_uncategorized_topics) {
      if (this.get('rootNone')) {
        return "category.none";
      } else {
        return Discourse.Category.list().findBy('id', Discourse.Site.currentProp('uncategorized_category_id'));
      }
    } else {
      return 'category.choose';
    }
  }.property(),

  template: function(text, templateData) {
    if (!templateData.color) return text;

    var result = "<div class='badge-category' style='background-color: #" + templateData.color + '; color: #' +
        templateData.text_color + ";'>" + (templateData.read_restricted === 'true' ? "<i class='fa fa-group'></i> " : "") + templateData.name + "</div>";

    result += " <div class='topic-count'>&times; " + templateData.topic_count + "</div>";

    var description = templateData.description_text;
    // TODO wtf how can this be null?
    if (description && description !== 'null') {

      result += '<div class="category-desc">' +
                 description.substr(0,200) +
                 (description.length > 200 ? '&hellip;' : '') +
                 '</div>';
    }
    return result;
  }

});

Discourse.View.registerHelper('categoryChooser', Discourse.CategoryChooserView);
