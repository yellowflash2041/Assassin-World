export default Ember.View.extend({
  elementId: 'discourse-modal',
  templateName: 'modal/modal',
  classNameBindings: [':modal', ':hidden', 'controller.modalClass'],

  click: function(e) {
    var $target = $(e.target);
    if ($target.hasClass("modal-middle-container") ||
        $target.hasClass("modal-outer-container")) {
      // Delegate click to modal backdrop if clicked outside. We do this
      // because some CSS of ours seems to cover the backdrop and makes it
      // unclickable.
      $('.modal-backdrop').click();
    }
  }
});
