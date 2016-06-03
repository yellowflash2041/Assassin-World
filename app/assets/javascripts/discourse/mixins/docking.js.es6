const helper = {
  offset: () => (window.pageYOffset || $('html').scrollTop()) - $('#main').offset().top
};

export default Ember.Mixin.create({
  queueDockCheck: null,

  init() {
    this._super();
    this.queueDockCheck = () => {
      Ember.run.debounce(this, this.safeDockCheck, 5);
    };
  },

  safeDockCheck() {
    if (this.isDestroyed || this.isDestroying) { return; }
    this.dockCheck(helper);
  },

  didInsertElement() {
    this._super();

    $(window).bind('scroll.discourse-dock', this.queueDockCheck);
    $(document).bind('touchmove.discourse-dock', this.queueDockCheck);

    this.dockCheck(helper);
  },

  willDestroyElement() {
    this._super();
    $(window).unbind('scroll.discourse-dock', this.queueDockCheck);
    $(document).unbind('touchmove.discourse-dock', this.queueDockCheck);
  }
});
