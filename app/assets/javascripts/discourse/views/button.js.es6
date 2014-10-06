export default Discourse.View.extend({
  tagName: 'button',
  classNameBindings: [':btn', ':standard', 'dropDownToggle'],
  attributeBindings: ['title', 'data-toggle', 'data-share-url'],

  title: function() {
    return I18n.t(this.get('helpKey') || this.get('textKey'));
  }.property('helpKey', 'textKey'),

  text: function() {
    if (Em.empty(this.get('textKey'))) { return ""; }
    return I18n.t(this.get('textKey'));
  }.property('textKey'),

  render: function(buffer) {
    if (this.renderIcon) {
      this.renderIcon(buffer);
    }
    buffer.push(this.get('text'));
  }
});
