import { createWidget } from 'discourse/widgets/widget';
import transformPost from 'discourse/lib/transform-post';

const DAY = 1000 * 60 * 60 * 24;

export default createWidget('post-stream', {
  tagName: 'div.post-stream',


  html(attrs) {
    const posts = attrs.posts || [];
    const postArray = posts.toArray();

    const result = [];

    const before = attrs.gaps && attrs.gaps.before ? attrs.gaps.before : {};
    const after = attrs.gaps && attrs.gaps.before ? attrs.gaps.after : {};

    let prevPost;
    let prevDate;

    for (let i=0; i<postArray.length; i++) {
      const post = postArray[i];
      const nextPost = (i < postArray.length - 1) ? postArray[i+i] : null;

      const transformed = transformPost(this.currentUser, this.site, post, prevPost, nextPost);
      transformed.canCreatePost = attrs.canCreatePost;

      if (transformed.canManage) {
        transformed.multiSelect = attrs.multiSelect;

        if (attrs.multiSelect) {
          transformed.selected = attrs.selectedQuery(post);
          transformed.selectedPostsCount = attrs.selectedPostsCount;
        }
      }

      if (attrs.searchService) {
        transformed.highlightTerm = attrs.searchService.highlightTerm;
      }

      // Post gap - before
      const beforeGap = before[post.id];
      if (beforeGap) {
        result.push(this.attach('post-gap', { pos: 'before', postId: post.id, gap: beforeGap }, { model: post }));
      }

      // Handle time gaps
      const curTime = new Date(transformed.created_at).getTime();
      if (prevDate) {
        const daysSince = (curTime - prevDate) / DAY;
        if (daysSince > this.siteSettings.show_time_gap_days) {
          result.push(this.attach('time-gap', { daysSince }));
        }
      }
      prevDate = curTime;

      // actual post contents
      if (transformed.isSmallAction) {
        result.push(this.attach('post-small-action', transformed, { model: post }));
      } else {
        result.push(this.attach('post', transformed, { model: post }));
      }

      // Post gap - after
      const afterGap = after[post.id];
      if (afterGap) {
        result.push(this.attach('post-gap', { pos: 'after', postId: post.id, gap: afterGap }, { model: post }));
      }

      prevPost = post;
    }
    return result;
  }
});
