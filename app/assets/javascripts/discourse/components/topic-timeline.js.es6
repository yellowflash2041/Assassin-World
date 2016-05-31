import MountWidget from 'discourse/components/mount-widget';
import Docking from 'discourse/mixins/docking';
import { observes } from 'ember-addons/ember-computed-decorators';

export default MountWidget.extend(Docking, {
  widget: 'topic-timeline-container',
  dockBottom: null,
  dockAt: null,

  buildArgs() {
    return { topic: this.get('topic'),
             topicTrackingState: this.topicTrackingState,
             enteredIndex: this.get('enteredIndex'),
             dockAt: this.dockAt,
             dockBottom: this.dockBottom };
  },

  @observes('topic.highest_post_number')
  newPostAdded() {
    this.queueRerender(() => this.queueDockCheck());
  },

  dockCheck(info) {
    if (this.get('loading')) { return; }

    const topicTop = $('.container.posts').offset().top;
    const topicBottom = $('#topic-bottom').offset().top;
    const $timeline = this.$('.timeline-container');
    const timelineHeight = $timeline.height();
    const footerHeight = $('.timeline-footer-controls').outerHeight(true) || 0;

    const tTop = 140;

    const prev = this.dockAt;
    const posTop = tTop + info.offset();
    const pos = posTop + timelineHeight;

    this.dockBottom = false;
    if (posTop < topicTop) {
      this.dockAt = topicTop;
    } else if (pos > topicBottom) {
      this.dockAt = (topicBottom - timelineHeight) + footerHeight;
      this.dockBottom = true;
      if (this.dockAt < 0) { this.dockAt = 0; }
    } else {
      this.dockAt = null;
    }

    if (this.dockAt !== prev) {
      this.queueRerender();
    }
  },

  didInsertElement() {
    this._super();
    this.dispatch('topic:current-post-scrolled', 'timeline-scrollarea');
  },

  willDestroyElement() {
    this._super();
    this.appEvents.off('topic:current-post-scrolled');
  }
});
