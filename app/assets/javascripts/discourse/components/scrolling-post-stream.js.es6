import { keyDirty } from 'discourse/widgets/widget';
import MountWidget from 'discourse/components/mount-widget';

function findTopView($posts, viewportTop, min, max) {
  if (max < min) { return min; }

  while(max>min){
    const mid = Math.floor((min + max) / 2);
    const $post = $($posts[mid]);
    const viewBottom = $post.position().top + $post.height();

    if (viewBottom > viewportTop) {
      max = mid-1;
    } else {
      min = mid+1;
    }
  }

  return min;
}

export default MountWidget.extend({
  widget: 'post-stream',
  _topVisible: null,
  _bottomVisible: null,

  args: Ember.computed(function() {
    return this.getProperties('posts',
                              'canCreatePost',
                              'multiSelect',
                              'selectedQuery',
                              'selectedPostsCount',
                              'searchService');
  }).volatile(),

  scrolled() {
    const $w = $(window);
    const windowHeight = window.innerHeight ? window.innerHeight : $w.height();
    const slack = Math.round(windowHeight * 15);
    const onscreen = [];

    let windowTop = $w.scrollTop();

    const $posts = this.$('article.boxed');
    const viewportTop = windowTop - slack;
    const topView = findTopView($posts, viewportTop, 0, $posts.length-1);

    let windowBottom = windowTop + windowHeight;
    let viewportBottom = windowBottom + slack;

    const bodyHeight = $('body').height();
    if (windowBottom > bodyHeight) { windowBottom = bodyHeight; }
    if (viewportBottom > bodyHeight) { viewportBottom = bodyHeight; }

    let bottomView = topView;
    while (bottomView < $posts.length) {
      const post = $posts[bottomView];
      const $post = $(post);

      if (!$post) { break; }

      const viewTop = $post.offset().top;
      const viewBottom = viewTop + $post.height();

      if (viewTop > viewportBottom) { break; }

      if (viewBottom > windowTop && viewTop <= windowBottom) {
        onscreen.push(bottomView);
      }

      bottomView++;
    }

    const posts = this.posts;
    if (onscreen.length) {

      const refresh = () => this.queueRerender();
      const first = posts.objectAt(onscreen[0]);
      if (this._topVisible !== first) {
        this._topVisible = first;
        const $body = $('body');
        const elem = $posts[onscreen[0]];
        const elemId = elem.id;
        const $elem = $(elem);
        const elemPos = $elem.position();
        const distToElement = elemPos ? $body.scrollTop() - elemPos.top : 0;

        const topRefresh = () => {
          refresh();

          Ember.run.next(() => {
            const $refreshedElem = $(elemId);

            // Quickly going back might mean the element is destroyed
            const position = $refreshedElem.position();
            if (position && position.top) {
              $('html, body').scrollTop(position.top + distToElement);
            }
          });
        };
        this.sendAction('topVisibleChanged', { post: first, refresh: topRefresh });
      }

      const last = posts.objectAt(onscreen[onscreen.length-1]);
      if (this._bottomVisible !== last) {
        this._bottomVisible = last;
        this.sendAction('bottomVisibleChanged', { post: last, refresh });
      }
    } else {
      this._topVisible = null;
      this._bottomVisible = null;
    }

    const onscreenPostNumbers = onscreen.map(idx => posts.objectAt(idx).post_number);
    this.screenTrack.setOnscreen(onscreenPostNumbers);
  },

  _scrollTriggered() {
    Ember.run.scheduleOnce('afterRender', this, this.scrolled);
  },

  didInsertElement() {
    this._super();
    const debouncedScroll = () => Ember.run.debounce(this, this._scrollTriggered, 10);

    $(document).bind('touchmove.post-stream', debouncedScroll);
    $(window).bind('scroll.post-stream', debouncedScroll);
    this._scrollTriggered();

    this.appEvents.on('post-stream:refresh', postId => {
      if (postId) {
        keyDirty(`post-${postId}`);
      }
      this.queueRerender();
    });
  },

  willDestroyElement() {
    this._super();
    $(document).unbind('touchmove.post-stream');
    $(window).unbind('scroll.post-stream');
    this.appEvents.off('post-stream:refresh');
  }

});
