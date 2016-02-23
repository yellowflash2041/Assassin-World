import { moduleForWidget, widgetTest } from 'helpers/widget-test';

moduleForWidget('post-gutter');

widgetTest("duplicate links", {
  template: '{{mount-widget widget="post-gutter" args=args}}',
  setup() {
    this.set('args', {
      links: [
        { title: "Evil Trout Link", url: "http://eviltrout.com" },
        { title: "Evil Trout Link", url: "http://dupe.eviltrout.com" }
      ]
    });
  },
  test(assert) {
    assert.equal(this.$('.post-links a.track-link').length, 1, 'it hides the dupe link');
  }
});

widgetTest("collapsed links", {
  template: '{{mount-widget widget="post-gutter" args=args}}',
  setup() {
    this.set('args', {
      links: [
        { title: "Link 1", url: "http://eviltrout.com?1" },
        { title: "Link 2", url: "http://eviltrout.com?2" },
        { title: "Link 3", url: "http://eviltrout.com?3" },
        { title: "Link 4", url: "http://eviltrout.com?4" },
        { title: "Link 5", url: "http://eviltrout.com?5" },
        { title: "Link 6", url: "http://eviltrout.com?6" },
        { title: "Link 7", url: "http://eviltrout.com?7" },
      ]
    });
  },
  test(assert) {
    assert.equal(this.$('.post-links a.track-link').length, 5, 'collapses by default');
    click('a.toggle-more');
    andThen(() => {
      assert.equal(this.$('.post-links a.track-link').length, 7);
    });
  }
});

widgetTest("reply as new topic", {
  template: '{{mount-widget widget="post-gutter" args=args newTopicAction="newTopicAction"}}',
  setup() {
    this.set('args', { canReplyAsNewTopic: true });
    this.on('newTopicAction', () => this.newTopicTriggered = true);
  },
  test(assert) {
    click('a.reply-new');
    andThen(() => assert.ok(this.newTopicTriggered));
  }
});
