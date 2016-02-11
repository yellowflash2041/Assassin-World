import { createWidget } from 'discourse/widgets/widget';
import RawHtml from 'discourse/widgets/raw-html';
import { iconNode } from 'discourse/helpers/fa-icon';
import { h } from 'virtual-dom';
import { actionDescriptionHtml } from 'discourse/components/small-action';

const icons = {
  'closed.enabled': 'lock',
  'closed.disabled': 'unlock-alt',
  'autoclosed.enabled': 'lock',
  'autoclosed.disabled': 'unlock-alt',
  'archived.enabled': 'folder',
  'archived.disabled': 'folder-open',
  'pinned.enabled': 'thumb-tack',
  'pinned.disabled': 'thumb-tack unpinned',
  'pinned_globally.enabled': 'thumb-tack',
  'pinned_globally.disabled': 'thumb-tack unpinned',
  'visible.enabled': 'eye',
  'visible.disabled': 'eye-slash',
  'split_topic': 'sign-out',
  'invited_user': 'plus-circle',
  'removed_user': 'minus-circle'
};

export default createWidget('post-small-action', {
  tagName: 'div.small-action.clearfix',

  html(attrs) {
    const contents = [];

    if (attrs.canDelete) {
      contents.push(this.attach('button', {
        icon: 'times',
        action: 'deletePost',
        title: 'post.controls.delete'
      }));
    }

    if (attrs.canEdit) {
      contents.push(this.attach('button', {
        icon: 'pencil',
        action: 'editPost',
        title: 'post.controls.edit'
      }));
    }

    const description = actionDescriptionHtml(attrs.actionCode, attrs.created_at, attrs.actionCodeWho);
    contents.push(new RawHtml({ html: `<p>${description}</p>` }));

    if (attrs.cooked) {
      contents.push(new RawHtml({ html: `<div class='custom-message'>${attrs.cooked}</div>` }));
    }

    return [
      h('div.topic-avatar', iconNode(icons[attrs.actionCode] || 'exclamation')),
      h('div.small-action-desc', contents)
    ];
  }
});
