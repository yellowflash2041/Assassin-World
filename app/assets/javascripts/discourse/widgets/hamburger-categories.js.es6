import { createWidget } from 'discourse/widgets/widget';
import { h } from 'virtual-dom';

createWidget('hamburger-category', {
  tagName: 'li.category-link',

  html(c) {
    const results = [ this.attach('category_link', { category: c, allowUncategorized: true }) ];

    const unreadTotal = parseInt(c.get('unreadTopics'), 10) + parseInt(c.get('newTopics'), 10);
    if (unreadTotal) {
      results.push(h('a.badge.badge-notification', { attributes: { href: c.get('url') } }, unreadTotal.toString()));
    }

    if (!this.currentUser) {
      results.push(h('b.topics-count', c.get('topic_count').toString()));
    }

    return results;
  }
});

export default createWidget('hamburger-categories', {
  tagName: 'ul.category-links.clearfix',

  html(attrs) {
    const href = Discourse.getURL('/categories');
    const result = [h('li.heading',
                      h('a.d-link.categories-link', { attributes: { href } }, I18n.t('filters.categories.title'))
                    )];

    const categories = attrs.categories;
    if (categories.length === 0) { return; }
    return result.concat(categories.map(c => this.attach('hamburger-category', c)));
  }
});
