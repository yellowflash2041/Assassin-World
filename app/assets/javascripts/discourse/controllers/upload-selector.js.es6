import ModalFunctionality from 'discourse/mixins/modal-functionality';
import DiscourseController from 'discourse/controllers/controller';
import { setting } from 'discourse/lib/computed';

export default DiscourseController.extend(ModalFunctionality, {
  remote: Em.computed.not("local"),
  local: false,
  showMore: false,

  _initialize: function() {
    this.setProperties({
      local: this.get("allowLocal"),
      showMore: false
    });
  }.on('init'),

  maxSize: setting('max_attachment_size_kb'),
  allowLocal: Em.computed.gt('maxSize', 0),

  actions: {
    useLocal: function() { this.setProperties({ local: true, showMore: false}); },
    useRemote: function() { this.set("local", false); },
    toggleShowMore: function() { this.toggleProperty("showMore"); }
  }

});
