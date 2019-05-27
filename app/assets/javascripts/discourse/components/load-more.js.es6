import LoadMore from "discourse/mixins/load-more";

export default Ember.Component.extend(LoadMore, {
  init() {
    this._super(...arguments);

    this.set("eyelineSelector", this.selector);
  },

  actions: {
    loadMore() {
      this.action();
    }
  }
});
