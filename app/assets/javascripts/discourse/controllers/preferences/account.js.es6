import { iconHTML } from "discourse-common/lib/icon-library";
import CanCheckEmails from "discourse/mixins/can-check-emails";
import { default as computed } from "ember-addons/ember-computed-decorators";
import PreferencesTabController from "discourse/mixins/preferences-tab-controller";
import { propertyNotEqual, setting } from "discourse/lib/computed";
import { popupAjaxError } from "discourse/lib/ajax-error";
import showModal from "discourse/lib/show-modal";
import { findAll } from "discourse/models/login-method";
import { ajax } from "discourse/lib/ajax";
import { userPath } from "discourse/lib/url";

// Number of tokens shown by default.
const DEFAULT_AUTH_TOKENS_COUNT = 2;

export default Ember.Controller.extend(
  CanCheckEmails,
  PreferencesTabController,
  {
    init() {
      this._super(...arguments);

      this.saveAttrNames = ["name", "title"];
      this.set("revoking", {});
    },

    canEditName: setting("enable_names"),
    canSaveUser: true,

    newNameInput: null,
    newTitleInput: null,

    passwordProgress: null,

    showAllAuthTokens: false,

    revoking: null,

    cannotDeleteAccount: Ember.computed.not("currentUser.can_delete_account"),
    deleteDisabled: Ember.computed.or(
      "model.isSaving",
      "deleting",
      "cannotDeleteAccount"
    ),

    reset() {
      this.set("passwordProgress", null);
    },

    @computed()
    nameInstructions() {
      return I18n.t(
        this.siteSettings.full_name_required
          ? "user.name.instructions_required"
          : "user.name.instructions"
      );
    },

    canSelectTitle: Ember.computed.gt("model.availableTitles.length", 0),

    @computed("model.is_anonymous")
    canChangePassword(isAnonymous) {
      if (isAnonymous) {
        return false;
      } else {
        return (
          !this.siteSettings.enable_sso && this.siteSettings.enable_local_logins
        );
      }
    },

    @computed("model.associated_accounts")
    associatedAccountsLoaded(associatedAccounts) {
      return typeof associatedAccounts !== "undefined";
    },

    @computed("model.associated_accounts.[]")
    authProviders(accounts) {
      const allMethods = findAll();

      const result = allMethods.map(method => {
        return {
          method,
          account: accounts.find(account => account.name === method.name) // Will be undefined if no account
        };
      });

      return result.filter(value => value.account || value.method.can_connect);
    },

    disableConnectButtons: propertyNotEqual("model.id", "currentUser.id"),

    @computed(
      "model.second_factor_enabled",
      "canCheckEmails",
      "model.is_anonymous"
    )
    canUpdateAssociatedAccounts(
      secondFactorEnabled,
      canCheckEmails,
      isAnonymous
    ) {
      if (secondFactorEnabled || !canCheckEmails || isAnonymous) {
        return false;
      }
      return findAll().length > 0;
    },

    @computed("showAllAuthTokens", "model.user_auth_tokens")
    authTokens(showAllAuthTokens, tokens) {
      tokens.sort((a, b) => {
        if (a.is_active) {
          return -1;
        } else if (b.is_active) {
          return 1;
        } else {
          return b.seen_at.localeCompare(a.seen_at);
        }
      });

      return showAllAuthTokens
        ? tokens
        : tokens.slice(0, DEFAULT_AUTH_TOKENS_COUNT);
    },

    canShowAllAuthTokens: Ember.computed.gt(
      "model.user_auth_tokens.length",
      DEFAULT_AUTH_TOKENS_COUNT
    ),

    actions: {
      save() {
        this.set("saved", false);

        this.model.setProperties({
          name: this.newNameInput,
          title: this.newTitleInput
        });

        return this.model
          .save(this.saveAttrNames)
          .then(() => this.set("saved", true))
          .catch(popupAjaxError);
      },

      changePassword() {
        if (!this.passwordProgress) {
          this.set(
            "passwordProgress",
            I18n.t("user.change_password.in_progress")
          );
          return this.model
            .changePassword()
            .then(() => {
              // password changed
              this.setProperties({
                changePasswordProgress: false,
                passwordProgress: I18n.t("user.change_password.success")
              });
            })
            .catch(() => {
              // password failed to change
              this.setProperties({
                changePasswordProgress: false,
                passwordProgress: I18n.t("user.change_password.error")
              });
            });
        }
      },

      delete() {
        this.set("deleting", true);
        const message = I18n.t("user.delete_account_confirm"),
          model = this.model,
          buttons = [
            {
              label: I18n.t("cancel"),
              class: "d-modal-cancel",
              link: true,
              callback: () => {
                this.set("deleting", false);
              }
            },
            {
              label:
                iconHTML("exclamation-triangle") +
                I18n.t("user.delete_account"),
              class: "btn btn-danger",
              callback() {
                model.delete().then(
                  () => {
                    bootbox.alert(
                      I18n.t("user.deleted_yourself"),
                      () => (window.location = Discourse.getURL("/"))
                    );
                  },
                  () => {
                    bootbox.alert(I18n.t("user.delete_yourself_not_allowed"));
                    this.set("deleting", false);
                  }
                );
              }
            }
          ];
        bootbox.dialog(message, buttons, { classes: "delete-account" });
      },

      revokeAccount(account) {
        this.set(`revoking.${account.name}`, true);

        this.model
          .revokeAssociatedAccount(account.name)
          .then(result => {
            if (result.success) {
              this.model.associated_accounts.removeObject(account);
            } else {
              bootbox.alert(result.message);
            }
          })
          .catch(popupAjaxError)
          .finally(() => this.set(`revoking.${account.name}`, false));
      },

      toggleShowAllAuthTokens() {
        this.toggleProperty("showAllAuthTokens");
      },

      revokeAuthToken(token) {
        ajax(
          userPath(
            `${this.get("model.username_lower")}/preferences/revoke-auth-token`
          ),
          {
            type: "POST",
            data: token ? { token_id: token.id } : {}
          }
        )
          .then(() => {
            if (!token) {
              const redirect = this.siteSettings.logout_redirect;
              if (Ember.isEmpty(redirect)) {
                window.location = Discourse.getURL("/");
              } else {
                window.location.href = redirect;
              }
            }
          })
          .catch(popupAjaxError);
      },

      showToken(token) {
        showModal("auth-token", { model: token });
      },

      connectAccount(method) {
        method.doLogin({ reconnect: true, fullScreenLogin: false });
      }
    }
  }
);
