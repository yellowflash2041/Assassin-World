function actionDescription(action, acted, count) {
  if (acted) {
    if (count <= 1) {
      return I18n.t(`post.actions.by_you.${action}`);
    } else {
      return I18n.t(`post.actions.by_you_and_others.${action}`, { count: count - 1 });
    }
  } else {
    return I18n.t(`post.actions.by_others.${action}`, { count });
  }
}

const _additionalAttributes = [];

export function includeAttributes(...attributes) {
  attributes.forEach(a => _additionalAttributes.push(a));
}

export function transformBasicPost(post) {
  // Note: it can be dangerous to not use `get` in Ember code, but this is significantly
  // faster and has tests to confirm it works. We only call `get` when the property is a CP
  return {
    id: post.id,
    hidden: post.hidden,
    deleted: post.get('deleted'),
    deleted_at: post.deleted_at,
    user_deleted: post.user_deleted,
    isDeleted: post.deleted_at || post.user_deleted,
    deletedByAvatarTemplate: null,
    deletedByUsername: null,
    primary_group_name: post.primary_group_name,
    wiki: post.wiki,
    firstPost: post.post_number === 1,
    post_number: post.post_number,
    cooked: post.cooked,
    via_email: post.via_email,
    user_id: post.user_id,
    usernameUrl: Discourse.getURL(`/users/${post.username}`),
    username: post.username,
    avatar_template: post.avatar_template,
    bookmarked: post.bookmarked,
    yours: post.yours,
    shareUrl: post.get('shareUrl'),
    staff: post.staff,
    admin: post.admin,
    moderator: post.moderator,
    new_user: post.trust_level === 0,
    name: post.name,
    user_title: post.user_title,
    created_at: post.created_at,
    updated_at: post.updated_at,
    canDelete: post.can_delete,
    canRecover: post.can_recover,
    canEdit: post.can_edit,
    canFlag: !Ember.isEmpty(post.get('flagsAvailable')),
    version: post.version,
    canRecoverTopic: false,
    canDeletedTopic: false,
    canViewEditHistory: post.can_view_edit_history,
    canWiki: post.can_wiki,
    showLike: false,
    liked: false,
    canToggleLike: false,
    likeCount: false,
    actionsSummary: null,
    read: post.read,
    replyToUsername: null,
    replyToAvatarTemplate: null,
    reply_to_post_number: post.reply_to_post_number,
    cooked_hidden: !!post.cooked_hidden,
    expandablePost: false,
    replyCount: post.reply_count,
  };

}


export default function transformPost(currentUser, site, post, prevPost, nextPost) {
  // Note: it can be dangerous to not use `get` in Ember code, but this is significantly
  // faster and has tests to confirm it works. We only call `get` when the property is a CP
  const postType = post.post_type;
  const postTypes = site.post_types;
  const topic = post.topic;
  const details = topic.get('details');

  const postAtts = transformBasicPost(post);

  const createdBy = details.created_by || {};

  postAtts.topicId = topic.id;
  postAtts.topicOwner = createdBy.id === post.user_id;
  postAtts.topicCreatedById = createdBy.id;
  postAtts.post_type = postType;
  postAtts.via_email = post.via_email;
  postAtts.isModeratorAction = postType === postTypes.moderator_action;
  postAtts.isWhisper = postType === postTypes.whisper;
  postAtts.isSmallAction = postType === postTypes.small_action;
  postAtts.canBookmark = !!currentUser;
  postAtts.canManage = currentUser && currentUser.get('canManageTopic');
  postAtts.canViewRawEmail = currentUser && (currentUser.id === post.user_id || currentUser.staff);
  postAtts.canReplyAsNewTopic = details.can_reply_as_new_topic;
  postAtts.isWarning = topic.is_warning;
  postAtts.links = post.get('internalLinks');
  postAtts.replyDirectlyBelow = nextPost && nextPost.reply_to_post_number === post.post_number;
  postAtts.replyDirectlyAbove = prevPost && post.reply_to_post_number === prevPost.post_number;
  postAtts.linkCounts = post.link_counts;
  postAtts.actionCode = post.action_code;
  postAtts.actionCodeWho = post.action_code_who;
  postAtts.userCustomFields = post.user_custom_fields;
  postAtts.topicUrl = topic.get('url');

  const showPMMap = topic.archetype === 'private_message' && post.post_number === 1;
  if (showPMMap) {
    postAtts.showPMMap = true;
    postAtts.allowedGroups = details.allowed_groups;
    postAtts.allowedUsers = details.allowed_users;
    postAtts.canRemoveAllowedUsers = details.can_remove_allowed_users;
    postAtts.canInvite = details.can_invite_to;
  }

  const showTopicMap = showPMMap || (post.post_number === 1 && topic.archetype === 'regular' && topic.posts_count > 1);
  if (showTopicMap) {
    postAtts.showTopicMap = true;
    postAtts.topicCreatedAt = topic.created_at;
    postAtts.createdByUsername = createdBy.username;
    postAtts.createdByAvatarTemplate = createdBy.avatar_template;

    postAtts.lastPostUrl = topic.get('lastPostUrl');
    postAtts.lastPostUsername = details.last_poster.username;
    postAtts.lastPostAvatarTemplate = details.last_poster.avatar_template;
    postAtts.lastPostAt = topic.last_posted_at;

    postAtts.topicReplyCount = topic.get('replyCount');
    postAtts.topicViews = topic.views;
    postAtts.topicViewsHeat = topic.get('viewsHeat');

    postAtts.participantCount = topic.participant_count;
    postAtts.topicLikeCount = topic.like_count;
    postAtts.topicLinks = details.links;
    if (postAtts.topicLinks) {
      postAtts.topicLinkLength = details.links.length;
    }
    postAtts.topicPostsCount = topic.posts_count;

    postAtts.participants = details.participants;

    const postStream = topic.get('postStream');
    postAtts.userFilters = postStream.userFilters;
    postAtts.topicSummaryEnabled = postStream.summary;
    postAtts.topicWordCount = topic.word_count;
    postAtts.hasTopicSummary = topic.has_summary;
  }

  if (postAtts.isDeleted) {
    postAtts.deletedByAvatarTemplate = post.get('postDeletedBy.avatar_template');
    postAtts.deletedByUsername = post.get('postDeletedBy.username');
  }

  const replyToUser = post.get('reply_to_user');
  if (replyToUser) {
    postAtts.replyToUsername = replyToUser.username;
    postAtts.replyToAvatarTemplate = replyToUser.avatar_template;
  }

  if (post.actions_summary) {
    postAtts.actionsSummary = post.actions_summary.filter(a => {
      return a.actionType.name_key !== 'like' && a.count > 0;
    }).map(a => {
      const acted = a.acted;
      const action = a.actionType.name_key;
      const count = a.count;

      return { id: a.id,
               postId: post.id,
               action,
               acted,
               count,
               canUndo: a.can_undo,
               canDeferFlags: a.can_defer_flags,
               description: actionDescription(action, acted, count) };
    });
  }

  const likeAction = post.likeAction;
  if (likeAction) {
    postAtts.liked = likeAction.acted;
    postAtts.canToggleLike = likeAction.get('canToggle');
    postAtts.showLike = postAtts.liked || postAtts.canToggleLike;
    postAtts.likeCount = likeAction.count;
  }

  if (postAtts.post_number === 1) {
    postAtts.canRecoverTopic = topic.deleted_at && details.can_recover;
    postAtts.canDeleteTopic = !topic.deleted_at && details.can_delete;
    postAtts.expandablePost = topic.expandable_first_post;
  } else {
    postAtts.canRecover = postAtts.isDeleted && postAtts.canRecover;
    postAtts.canDelete = !postAtts.isDeleted && postAtts.canDelete;
  }

  _additionalAttributes.forEach(a => postAtts[a] = post[a]);

  return postAtts;
}
