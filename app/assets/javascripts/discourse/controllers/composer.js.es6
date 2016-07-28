import DiscourseURL from 'discourse/lib/url';
import Quote from 'discourse/lib/quote';
import Draft from 'discourse/models/draft';
import Composer from 'discourse/models/composer';
import { default as computed, observes } from 'ember-addons/ember-computed-decorators';
import { relativeAge } from 'discourse/lib/formatter';
import { escapeExpression } from 'discourse/lib/utilities';
import InputValidation from 'discourse/models/input-validation';

function loadDraft(store, opts) {
  opts = opts || {};

  let draft = opts.draft;
  const draftKey = opts.draftKey;
  const draftSequence = opts.draftSequence;

  try {
    if (draft && typeof draft === 'string') {
      draft = JSON.parse(draft);
    }
  } catch (error) {
    draft = null;
    Draft.clear(draftKey, draftSequence);
  }
  if (draft && ((draft.title && draft.title !== '') || (draft.reply && draft.reply !== ''))) {
    const composer = store.createRecord('composer');
    composer.open({
      draftKey,
      draftSequence,
      action: draft.action,
      title: draft.title,
      categoryId: draft.categoryId || opts.categoryId,
      postId: draft.postId,
      archetypeId: draft.archetypeId,
      reply: draft.reply,
      metaData: draft.metaData,
      usernames: draft.usernames,
      draft: true,
      composerState: Composer.DRAFT,
      composerTime: draft.composerTime,
      typingTime: draft.typingTime
    });
    return composer;
  }
}

const _popupMenuOptionsCallbacks = [];

export function addPopupMenuOptionsCallback(callback) {
  _popupMenuOptionsCallbacks.push(callback);
}

export default Ember.Controller.extend({
  needs: ['modal', 'topic', 'application'],
  replyAsNewTopicDraft: Em.computed.equal('model.draftKey', Composer.REPLY_AS_NEW_TOPIC_KEY),
  checkedMessages: false,
  messageCount: null,
  showEditReason: false,
  editReason: null,
  scopedCategoryId: null,
  optionsVisible: false,
  lastValidatedAt: null,
  isUploading: false,
  topic: null,
  linkLookup: null,
  whisperOrUnlistTopic: Ember.computed.or('model.whisper', 'model.unlistTopic'),

  @computed('model.replyingToTopic', 'model.creatingPrivateMessage', 'model.targetUsernames')
  focusTarget(replyingToTopic, creatingPM, usernames) {
    if (this.capabilities.isIOS) { return "none"; }

    if (creatingPM && usernames === this.currentUser.get('username')) {
      return 'usernames';
    }

    if (replyingToTopic) {
      return 'reply';
    }

    return 'title';
  },

  showToolbar: Em.computed({
    get(){
      const keyValueStore = this.container.lookup('key-value-store:main');
      const storedVal = keyValueStore.get("toolbar-enabled");
      if (this._toolbarEnabled === undefined && storedVal === undefined) {
        // iPhone 6 is 375, anything narrower and toolbar should
        // be default disabled.
        // That said we should remember the state
        this._toolbarEnabled = $(window).width() > 370 && !this.capabilities.isAndroid;
      }
      return this._toolbarEnabled || storedVal === "true";
    },
    set(key, val){
      const keyValueStore = this.container.lookup('key-value-store:main');
      this._toolbarEnabled = val;
      keyValueStore.set({key: "toolbar-enabled", value: val ? "true" : "false"});
      return val;
    }
  }),

  topicModel: Ember.computed.alias('controllers.topic.model'),

  @computed('model.canEditTitle', 'model.creatingPrivateMessage')
  canEditTags(canEditTitle, creatingPrivateMessage) {
    return !this.site.mobileView &&
            this.site.get('can_tag_topics') &&
            canEditTitle &&
            !creatingPrivateMessage;
  },

  @computed('model.whisper', 'model.unlistTopic')
  whisperOrUnlistTopicText(whisper, unlistTopic) {
    if (whisper) {
      return I18n.t("composer.whisper");
    } else if (unlistTopic) {
      return I18n.t("composer.unlist");
    }
  },

  @computed
  isStaffUser() {
    const currentUser = this.currentUser;
    return currentUser && currentUser.get('staff');
  },

  canUnlistTopic: Em.computed.and('model.creatingTopic', 'isStaffUser'),

  @computed('model.action', 'isStaffUser')
  canWhisper(action, isStaffUser) {
    return isStaffUser && this.siteSettings.enable_whispers && action === Composer.REPLY;
  },

  @computed("popupMenuOptions")
  showPopupMenu(popupMenuOptions) {
    return popupMenuOptions ? popupMenuOptions.some(option => option.condition) : false;
  },

  _setupPopupMenuOption(callback) {
    let option = callback();

    if (option.condition) {
      option.condition = this.get(option.condition);
    } else {
      option.condition = true;
    }

    return option;
  },

  @computed("model.composeState", "model.creatingTopic")
  popupMenuOptions(composeState) {
    if (composeState === 'open') {
      let options = [];

      options.push(this._setupPopupMenuOption(() => {
        return {
          action: 'toggleInvisible',
          icon: 'eye-slash',
          label: 'composer.toggle_unlisted',
          condition: "canUnlistTopic"
        };
      }));

      options.push(this._setupPopupMenuOption(() => {
        return {
          action: 'toggleWhisper',
          icon: 'eye-slash',
          label: 'composer.toggle_whisper',
          condition: "canWhisper"
        };
      }));

      return options.concat(_popupMenuOptionsCallbacks.map(callback => {
        return this._setupPopupMenuOption(callback);
      }));
    }
  },

  showWarning: function() {
    if (!Discourse.User.currentProp('staff')) { return false; }

    var usernames = this.get('model.targetUsernames');
    var hasTargetGroups = this.get('model.hasTargetGroups');

    // We need exactly one user to issue a warning
    if (Ember.isEmpty(usernames) || usernames.split(',').length !== 1 || hasTargetGroups) {
      return false;
    }
    return this.get('model.creatingPrivateMessage');
  }.property('model.creatingPrivateMessage', 'model.targetUsernames'),

  actions: {
    addLinkLookup(linkLookup) {
      this.set('linkLookup', linkLookup);
    },

    afterRefresh($preview) {
      const topic = this.get('model.topic');
      const linkLookup = this.get('linkLookup');
      if (!topic || !linkLookup) { return; }

      // Don't check if there's only one post
      if (topic.get('posts_count') === 1) { return; }

      const post = this.get('model.post');
      if (post && post.get('user_id') !== this.currentUser.id) { return; }

      const $links = $('a[href]', $preview);
      $links.each((idx, l) => {
        const href = $(l).prop('href');
        if (href && href.length) {
          const [warn, info] = linkLookup.check(post, href);

          if (warn) {
            const body = I18n.t('composer.duplicate_link', {
              domain: info.domain,
              username: info.username,
              post_url: topic.urlForPostNumber(info.post_number),
              ago: relativeAge(moment(info.posted_at).toDate(), { format: 'medium' })
            });
            this.appEvents.trigger('composer-messages:create', {
              extraClass: 'custom-body',
              templateName: 'custom-body',
              body
            });
            return false;
          }
        }
        return true;
      });
    },

    toggleWhisper() {
      this.toggleProperty('model.whisper');
    },

    toggleInvisible() {
      this.toggleProperty('model.unlistTopic');
    },

    toggleToolbar() {
      this.toggleProperty('showToolbar');
    },

    showOptions(toolbarEvent, loc) {
      this.set('toolbarEvent', toolbarEvent);
      this.appEvents.trigger('popup-menu:open', loc);
      this.set('optionsVisible', true);
    },

    hideOptions() {
      this.set('optionsVisible', false);
    },

    // Toggle the reply view
    toggle() {
      this.toggle();
    },

    togglePreview() {
      this.get('model').togglePreview();
    },

    // Import a quote from the post
    importQuote(toolbarEvent) {
      const postStream = this.get('topic.postStream');
      let postId = this.get('model.post.id');

      // If there is no current post, use the first post id from the stream
      if (!postId && postStream) {
        postId = postStream.get('stream.firstObject');
      }

      // If we're editing a post, fetch the reply when importing a quote
      if (this.get('model.editingPost')) {
        const replyToPostNumber = this.get('model.post.reply_to_post_number');
        if (replyToPostNumber) {
          const replyPost = postStream.get('posts').findBy('post_number', replyToPostNumber);
          if (replyPost) {
            postId = replyPost.get('id');
          }
        }
      }

      if (postId) {
        this.set('model.loading', true);
        const composer = this;

        return this.store.find('post', postId).then(function(post) {
          const quote = Quote.build(post, post.get("raw"), {raw: true, full: true});
          toolbarEvent.addText(quote);
          composer.set('model.loading', false);
        });
      }
    },

    cancel() {
      this.cancelComposer();
    },

    save() {
      this.save();
    },

    displayEditReason() {
      this.set("showEditReason", true);
    },

    hitEsc() {
      if ((this.get('messageCount') || 0) > 0) {
        this.appEvents.trigger('composer-messages:close');
        return;
      }

      if (this.get('model.viewOpen')) {
        this.shrink();
      }
    },

    openIfDraft() {
      if (this.get('model.viewDraft')) {
        this.set('model.composeState', Composer.OPEN);
      }
    },

    groupsMentioned(groups) {
      if (!this.get('model.creatingPrivateMessage') && !this.get('model.topic.isPrivateMessage')) {
        groups.forEach(group => {
          const body = I18n.t('composer.group_mentioned', {
            group: "@" + group.name,
            count: group.user_count,
            group_link: Discourse.getURL(`/group/${group.name}/members`)
          });
          this.appEvents.trigger('composer-messages:create', {
            extraClass: 'custom-body',
            templateName: 'custom-body',
            body
          });
        });
      }
    }

  },

  categories: function() {
    return Discourse.Category.list();
  }.property(),

  toggle() {
    this.closeAutocomplete();
    switch (this.get('model.composeState')) {
      case Composer.OPEN:
        if (Ember.isEmpty(this.get('model.reply')) && Ember.isEmpty(this.get('model.title'))) {
          this.close();
        } else {
          this.shrink();
        }
        break;
      case Composer.DRAFT:
        this.set('model.composeState', Composer.OPEN);
        break;
      case Composer.SAVING:
        this.close();
    }
    return false;
  },

  disableSubmit: Ember.computed.or("model.loading", "isUploading"),

  save(force) {
    const composer = this.get('model');
    const self = this;

    // Clear the warning state if we're not showing the checkbox anymore
    if (!this.get('showWarning')) {
      this.set('model.isWarning', false);
    }

    if (composer.get('cantSubmitPost')) {
      this.set('lastValidatedAt', Date.now());
      return;
    }

    composer.set('disableDrafts', true);

    // for now handle a very narrow use case
    // if we are replying to a topic AND not on the topic pop the window up
    if (!force && composer.get('replyingToTopic')) {

      const currentTopic = this.get('topicModel');
      if (!currentTopic || currentTopic.get('id') !== composer.get('topic.id'))
      {
        const message = I18n.t("composer.posting_not_on_topic");

        let buttons = [{
          "label": I18n.t("composer.cancel"),
          "class": "cancel",
          "link": true
        }];

        if (currentTopic) {
          buttons.push({
            "label": I18n.t("composer.reply_here") + "<br/><div class='topic-title overflow-ellipsis'>" + escapeExpression(currentTopic.get('title')) + "</div>",
            "class": "btn btn-reply-here",
            "callback": function() {
              composer.set('topic', currentTopic);
              composer.set('post', null);
              self.save(true);
            }
          });
        }

        buttons.push({
          "label": I18n.t("composer.reply_original") + "<br/><div class='topic-title overflow-ellipsis'>" + escapeExpression(this.get('model.topic.title')) + "</div>",
          "class": "btn-primary btn-reply-on-original",
          "callback": function() {
            self.save(true);
          }
        });

        bootbox.dialog(message, buttons, { "classes": "reply-where-modal" });
        return;
      }
    }

    var staged = false;

    // TODO: This should not happen in model
    const imageSizes = {};
    $('#reply-control .d-editor-preview img').each((i, e) => {
      const $img = $(e);
      const src = $img.prop('src');

      if (src && src.length) {
        imageSizes[src] = { width: $img.width(), height: $img.height() };
      }
    });

    const promise = composer.save({ imageSizes, editReason: this.get("editReason")}).then(function(result) {
      if (result.responseJson.action === "enqueued") {
        self.send('postWasEnqueued', result.responseJson);
        self.destroyDraft();
        self.close();
        self.appEvents.trigger('post-stream:refresh');
        return result;
      }

      // If user "created a new topic/post" or "replied as a new topic" successfully, remove the draft.
      if (result.responseJson.action === "create_post" || self.get('replyAsNewTopicDraft')) {
        self.destroyDraft();
      }
      if (self.get('model.action') === 'edit') {
        self.appEvents.trigger('post-stream:refresh', { id: parseInt(result.responseJson.id) });
      } else {
        self.appEvents.trigger('post-stream:refresh');
      }

      if (result.responseJson.action === "create_post") {
        self.appEvents.trigger('post:highlight', result.payload.post_number);
      }
      self.close();

      const currentUser = Discourse.User.current();
      if (composer.get('creatingTopic')) {
        currentUser.set('topic_count', currentUser.get('topic_count') + 1);
      } else {
        currentUser.set('reply_count', currentUser.get('reply_count') + 1);
      }

      const disableJumpReply = Discourse.User.currentProp('disable_jump_reply');
      if (!composer.get('replyingToTopic') || !disableJumpReply) {
        const post = result.target;
        if (post && !staged) {
          DiscourseURL.routeTo(post.get('url'));
        }
      }

    }).catch(function(error) {
      composer.set('disableDrafts', false);
      self.appEvents.one('composer:will-open', () => bootbox.alert(error));
    });

    if (this.get('controllers.application.currentRouteName').split('.')[0] === 'topic' &&
        composer.get('topic.id') === this.get('topicModel.id')) {
      staged = composer.get('stagedPost');
    }

    this.appEvents.trigger('post-stream:posted', staged);

    this.messageBus.pause();
    promise.finally(() => this.messageBus.resume());

    return promise;
  },

  // Notify the composer messages controller that a reply has been typed. Some
  // messages only appear after typing.
  checkReplyLength() {
    if (!Ember.isEmpty('model.reply')) {
      this.appEvents.trigger('composer:typed-reply');
    }
  },

  /**
    Open the composer view

    @method open
    @param {Object} opts Options for creating a post
      @param {String} opts.action The action we're performing: edit, reply or createTopic
      @param {Discourse.Post} [opts.post] The post we're replying to
      @param {Discourse.Topic} [opts.topic] The topic we're replying to
      @param {String} [opts.quote] If we're opening a reply from a quote, the quote we're making
  **/
  open(opts) {
    opts = opts || {};

    if (!opts.draftKey) {
      alert("composer was opened without a draft key");
      throw "composer opened without a proper draft key";
    }
    const self = this;
    let composerModel = this.get('model');

    if (opts.ignoreIfChanged && composerModel && composerModel.composeState !== Composer.CLOSED) {
      return;
    }

    // If we show the subcategory list, scope the categories drop down to
    // the category we opened the composer with.
    if (this.siteSettings.show_subcategory_list && opts.draftKey !== 'reply_as_new_topic') {
      this.set('scopedCategoryId', opts.categoryId);
    }

    this.setProperties({ showEditReason: false, editReason: null });

    // If we want a different draft than the current composer, close it and clear our model.
    if (composerModel &&
        opts.draftKey !== composerModel.draftKey &&
        composerModel.composeState === Composer.DRAFT) {
      this.close();
      composerModel = null;
    }

    return new Ember.RSVP.Promise(function(resolve, reject) {
      if (composerModel && composerModel.get('replyDirty')) {

        // If we're already open, we don't have to do anything
        if (composerModel.get('composeState') === Composer.OPEN &&
            composerModel.get('draftKey') === opts.draftKey && !opts.action) {
          return resolve();
        }

        // If it's the same draft, just open it up again.
        if (composerModel.get('composeState') === Composer.DRAFT &&
            composerModel.get('draftKey') === opts.draftKey) {
          composerModel.set('composeState', Composer.OPEN);
          if (!opts.action) return resolve();
        }

        // If it's a different draft, cancel it and try opening again.
        return self.cancelComposer().then(function() {
          return self.open(opts);
        }).then(resolve, reject);
      }

      // we need a draft sequence for the composer to work
      if (opts.draftSequence === undefined) {
        return Draft.get(opts.draftKey).then(function(data) {
          opts.draftSequence = data.draft_sequence;
          opts.draft = data.draft;
          self._setModel(composerModel, opts);
        }).then(resolve, reject);
      }

      if (composerModel) {
        if (composerModel.get('action') !== opts.action) {
          composerModel.setProperties({ unlistTopic: false, whisper: false });
        }
      }

      self._setModel(composerModel, opts);
      resolve();
    });
  },

  // Given a potential instance and options, set the model for this composer.
  _setModel(composerModel, opts) {
    this.set('linkLookup', null);

    if (opts.draft) {
      composerModel = loadDraft(this.store, opts);
      if (composerModel) {
        composerModel.set('topic', opts.topic);
      }
    } else {
      composerModel = composerModel || this.store.createRecord('composer');
      composerModel.open(opts);
    }

    this.set('model', composerModel);
    composerModel.set('composeState', Composer.OPEN);
    composerModel.set('isWarning', false);

    if (opts.topicTitle && opts.topicTitle.length <= this.siteSettings.max_topic_title_length) {
      this.set('model.title', opts.topicTitle);
    }

    if (opts.topicCategoryId) {
      this.set('model.categoryId', opts.topicCategoryId);
    } else if (opts.topicCategory) {
      const splitCategory = opts.topicCategory.split("/");
      let category;

      if (!splitCategory[1]) {
        category = this.site.get('categories').findProperty('nameLower', splitCategory[0].toLowerCase());
      } else {
        const categories = Discourse.Category.list();
        const mainCategory = categories.findProperty('nameLower', splitCategory[0].toLowerCase());
        category = categories.find(function(item) {
          return item && item.get('nameLower') === splitCategory[1].toLowerCase() && item.get('parent_category_id') === mainCategory.id;
        });
      }

      if (category) {
        this.set('model.categoryId', category.get('id'));
      }
    }

    if (opts.topicTags && !this.site.mobileView && this.site.get('can_tag_topics')) {
      this.set('model.tags', opts.topicTags.split(","));
    }

    if (opts.topicBody) {
      this.set('model.reply', opts.topicBody);
    }
  },

  // View a new reply we've made
  viewNewReply() {
    DiscourseURL.routeTo(this.get('model.createdPost.url'));
    this.close();
    return false;
  },

  destroyDraft() {
    const key = this.get('model.draftKey');
    if (key) {
      Draft.clear(key, this.get('model.draftSequence'));
    }
  },

  cancelComposer() {
    const self = this;

    return new Ember.RSVP.Promise(function (resolve) {
      if (self.get('model.hasMetaData') || self.get('model.replyDirty')) {
        bootbox.confirm(I18n.t("post.abandon.confirm"), I18n.t("post.abandon.no_value"),
            I18n.t("post.abandon.yes_value"), function(result) {
          if (result) {
            self.destroyDraft();
            self.get('model').clearState();
            self.close();
            resolve();
          }
        });
      } else {
        // it is possible there is some sort of crazy draft with no body ... just give up on it
        self.destroyDraft();
        self.get('model').clearState();
        self.close();
        resolve();
      }
    });
  },

  shrink() {
    if (this.get('model.replyDirty')) {
      this.collapse();
    } else {
      this.close();
    }
  },

  _saveDraft() {
    const model = this.get('model');
    if (model) { model.saveDraft(); };
  },

  @observes('model.reply', 'model.title')
  _shouldSaveDraft() {
    Ember.run.debounce(this, this._saveDraft, 2000);
  },

  @computed('model.categoryId', 'lastValidatedAt')
  categoryValidation(categoryId, lastValidatedAt) {
    if( !this.siteSettings.allow_uncategorized_topics && !categoryId) {
      return InputValidation.create({ failed: true, reason: I18n.t('composer.error.category_missing'), lastShownAt: lastValidatedAt });
    }
  },

  collapse() {
    this._saveDraft();
    this.set('model.composeState', Composer.DRAFT);
  },

  close() {
    this.setProperties({ model: null, lastValidatedAt: null });
  },

  closeAutocomplete() {
    $('.d-editor-input').autocomplete({ cancel: true });
  },

  canEdit: function() {
    return this.get("model.action") === "edit" && Discourse.User.current().get("can_edit");
  }.property("model.action"),

  visible: function() {
    var state = this.get('model.composeState');
    return state && state !== 'closed';
  }.property('model.composeState')

});
