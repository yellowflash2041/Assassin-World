export default Ember.Controller.extend({
  adminBackups: Ember.inject.controller(),
  status: Ember.computed.alias("adminBackups.model"),

  init() {
    this._super(...arguments);

    this.logs = [];
  }
});
