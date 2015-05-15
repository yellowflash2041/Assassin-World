import showModal from 'discourse/lib/show-modal';
import OpenComposer from "discourse/mixins/open-composer";

function unlessReadOnly(method) {
  return function() {
    if (this.site.get("isReadOnly")) {
      bootbox.alert(I18n.t("read_only_mode.login_disabled"));
    } else {
      this[method]();
    }
  };
}

const ApplicationRoute = Discourse.Route.extend(OpenComposer, {

  siteTitle: Discourse.computed.setting('title'),

  actions: {
    _collectTitleTokens(tokens) {
      tokens.push(this.get('siteTitle'));
      Discourse.set('_docTitle', tokens.join(' - '));
    },

    // Ember doesn't provider a router `willTransition` event so let's make one
    willTransition() {
      var router = this.container.lookup('router:main');
      Ember.run.once(router, router.trigger, 'willTransition');
      return this._super();
    },

    // This is here as a bugfix for when an Ember Cloaked view triggers
    // a scroll after a controller has been torn down. The real fix
    // should be to fix ember cloaking to not do that, but this catches
    // it safely just in case.
    postChangedRoute: Ember.K,

    showTopicEntrance(data) {
      this.controllerFor('topic-entrance').send('show', data);
    },

    postWasEnqueued(details) {
      const title = details.reason ? 'queue_reason.' + details.reason + '.title' : 'queue.approval.title';
      showModal('post-enqueued', {model: details, title });
    },

    composePrivateMessage(user, post) {
      const self = this;
      this.transitionTo('userActivity', user).then(function () {
        self.controllerFor('user-activity').send('composePrivateMessage', user, post);
      });
    },

    error(err, transition) {
      if (err.status === 404) {
        // 404
        this.intermediateTransitionTo('unknown');
        return;
      }

      const exceptionController = this.controllerFor('exception'),
            stack = err.stack;

      // If we have a stack call `toString` on it. It gives us a better
      // stack trace since `console.error` uses the stack track of this
      // error callback rather than the original error.
      let errorString = err.toString();
      if (stack) { errorString = stack.toString(); }

      if (err.statusText) { errorString = err.statusText; }

      const c = window.console;
      if (c && c.error) {
        c.error(errorString);
      }
      exceptionController.setProperties({ lastTransition: transition, thrown: err });

      this.intermediateTransitionTo('exception');
    },

    showLogin: unlessReadOnly('handleShowLogin'),

    showCreateAccount: unlessReadOnly('handleShowCreateAccount'),

    showForgotPassword() {
      showModal('forgotPassword', { title: 'forgot_password.title' });
    },

    showNotActivated(props) {
      const controller = showModal('not-activated', {title: 'log_in' });
      controller.setProperties(props);
    },

    showUploadSelector(composerView) {
      showModal('uploadSelector');
      this.controllerFor('upload-selector').setProperties({ composerView: composerView });
    },

    showKeyboardShortcutsHelp() {
      showModal('keyboard-shortcuts-help', { title: 'keyboard_shortcuts_help.title'});
    },

    showSearchHelp() {
      // TODO: @EvitTrout how do we get a loading indicator here?
      Discourse.ajax("/static/search_help.html", { dataType: 'html' }).then(function(model){
        showModal('searchHelp', { model });
      });
    },

    // Close the current modal, and destroy its state.
    closeModal() {
      this.render('hide-modal', { into: 'modal', outlet: 'modalBody' });
    },

    /**
      Hide the modal, but keep it with all its state so that it can be shown again later.
      This is useful if you want to prompt for confirmation. hideModal, ask "Are you sure?",
      user clicks "No", reopenModal. If user clicks "Yes", be sure to call closeModal.
    **/
    hideModal() {
      $('#discourse-modal').modal('hide');
    },

    reopenModal() {
      $('#discourse-modal').modal('show');
    },

    editCategory(category) {
      const self = this;
      Discourse.Category.reloadById(category.get('id')).then(function (model) {
        self.site.updateCategory(model);
        showModal('editCategory', { model });
        self.controllerFor('editCategory').set('selectedTab', 'general');
      });
    },

    deleteSpammer: function (user) {
      this.send('closeModal');
      user.deleteAsSpammer(function() { window.location.reload(); });
    },

    checkEmail: function (user) {
      user.checkEmail();
    },

    changeBulkTemplate(w) {
      const controllerName = w.replace('modal/', ''),
            factory = this.container.lookupFactory('controller:' + controllerName);

      this.render(w, {into: 'modal/topic-bulk-actions', outlet: 'bulkOutlet', controller: factory ? controllerName : 'topic-bulk-actions'});
    },

    createNewTopicViaParams: function(title, body, category_id, category) {
      this.openComposerWithParams(this.controllerFor('discovery/topics'), title, body, category_id, category);
    }
  },

  activate() {
    this._super();
    Em.run.next(function() {
      // Support for callbacks once the application has activated
      ApplicationRoute.trigger('activate');
    });
  },

  handleShowLogin() {
    if (this.siteSettings.enable_sso) {
      const returnPath = encodeURIComponent(window.location.pathname);
      window.location = Discourse.getURL('/session/sso?return_path=' + returnPath);
    } else {
      this._autoLogin('login', 'login-modal', () => this.controllerFor('login').resetForm());
    }
  },

  handleShowCreateAccount() {
    this._autoLogin('createAccount', 'create-account');
  },

  _autoLogin(modal, modalClass, notAuto) {
    const methods = Em.get('Discourse.LoginMethod.all');
    if (!this.siteSettings.enable_local_logins && methods.length === 1) {
      this.controllerFor('login').send('externalLogin', methods[0]);
    } else {
      showModal(modal);
      this.controllerFor('modal').set('modalClass', modalClass);
      if (notAuto) { notAuto(); }
    }
  },

});

RSVP.EventTarget.mixin(ApplicationRoute);
export default ApplicationRoute;
