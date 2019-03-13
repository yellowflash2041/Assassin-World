import { emailValid } from "discourse/lib/utilities";
import computed from "ember-addons/ember-computed-decorators";
import Group from "discourse/models/group";
import Invite from "discourse/models/invite";
import { i18n } from "discourse/lib/computed";

export default Ember.Component.extend({
  tagName: null,

  inviteModel: Ember.computed.alias("panel.model.inviteModel"),
  userInvitedShow: Ember.computed.alias("panel.model.userInvitedShow"),

  // If this isn't defined, it will proxy to the user topic on the preferences
  // page which is wrong.
  emailOrUsername: null,
  hasCustomMessage: false,
  hasCustomMessage: false,
  customMessage: null,
  inviteIcon: "envelope",
  invitingExistingUserToTopic: false,

  isAdmin: Ember.computed.alias("currentUser.admin"),

  willDestroyElement() {
    this._super(...arguments);

    this.reset();
  },

  @computed(
    "isAdmin",
    "emailOrUsername",
    "invitingToTopic",
    "isPrivateTopic",
    "inviteModel.groupNames.[]",
    "inviteModel.saving",
    "inviteModel.details.can_invite_to"
  )
  disabled(
    isAdmin,
    emailOrUsername,
    invitingToTopic,
    isPrivateTopic,
    groupNames,
    saving,
    can_invite_to
  ) {
    if (saving) return true;
    if (Ember.isEmpty(emailOrUsername)) return true;

    const emailTrimmed = emailOrUsername.trim();

    // when inviting to forum, email must be valid
    if (!invitingToTopic && !emailValid(emailTrimmed)) {
      return true;
    }

    // normal users (not admin) can't invite users to private topic via email
    if (!isAdmin && isPrivateTopic && emailValid(emailTrimmed)) {
      return true;
    }

    // when inviting to private topic via email, group name must be specified
    if (
      isPrivateTopic &&
      Ember.isEmpty(groupNames) &&
      emailValid(emailTrimmed)
    ) {
      return true;
    }

    if (can_invite_to) return false;

    return false;
  },

  @computed(
    "isAdmin",
    "emailOrUsername",
    "inviteModel.saving",
    "isPrivateTopic",
    "inviteModel.groupNames.[]",
    "hasCustomMessage"
  )
  disabledCopyLink(
    isAdmin,
    emailOrUsername,
    saving,
    isPrivateTopic,
    groupNames,
    hasCustomMessage
  ) {
    if (hasCustomMessage) return true;
    if (saving) return true;
    if (Ember.isEmpty(emailOrUsername)) return true;

    const email = emailOrUsername.trim();

    // email must be valid
    if (!emailValid(email)) {
      return true;
    }

    // normal users (not admin) can't invite users to private topic via email
    if (!isAdmin && isPrivateTopic && emailValid(email)) {
      return true;
    }

    // when inviting to private topic via email, group name must be specified
    if (isPrivateTopic && Ember.isEmpty(groupNames) && emailValid(email)) {
      return true;
    }

    return false;
  },

  @computed("inviteModel.saving")
  buttonTitle(saving) {
    return saving ? "topic.inviting" : "topic.invite_reply.action";
  },

  // We are inviting to a topic if the topic isn't the current user.
  // The current user would mean we are inviting to the forum in general.
  @computed("inviteModel")
  invitingToTopic(inviteModel) {
    return inviteModel !== this.currentUser;
  },

  @computed("inviteModel", "inviteModel.details.can_invite_via_email")
  canInviteViaEmail(inviteModel, canInviteViaEmail) {
    return this.get("inviteModel") === this.currentUser
      ? true
      : canInviteViaEmail;
  },

  @computed("isPM", "canInviteViaEmail")
  showCopyInviteButton(isPM, canInviteViaEmail) {
    return canInviteViaEmail && !isPM;
  },

  topicId: Ember.computed.alias("inviteModel.id"),

  // eg: visible only to specific group members
  isPrivateTopic: Ember.computed.and(
    "invitingToTopic",
    "inviteModel.category.read_restricted"
  ),

  isPM: Ember.computed.equal("inviteModel.archetype", "private_message"),

  // scope to allowed usernames
  allowExistingMembers: Ember.computed.alias("invitingToTopic"),

  @computed("isAdmin", "inviteModel.group_users")
  isGroupOwnerOrAdmin(isAdmin, groupUsers) {
    return (
      isAdmin || (groupUsers && groupUsers.some(groupUser => groupUser.owner))
    );
  },

  // Show Groups? (add invited user to private group)
  @computed(
    "isGroupOwnerOrAdmin",
    "emailOrUsername",
    "isPrivateTopic",
    "isPM",
    "invitingToTopic",
    "canInviteViaEmail"
  )
  showGroups(
    isGroupOwnerOrAdmin,
    emailOrUsername,
    isPrivateTopic,
    isPM,
    invitingToTopic,
    canInviteViaEmail
  ) {
    return (
      isGroupOwnerOrAdmin &&
      canInviteViaEmail &&
      !isPM &&
      (emailValid(emailOrUsername) || isPrivateTopic || !invitingToTopic)
    );
  },

  @computed("emailOrUsername")
  showCustomMessage(emailOrUsername) {
    return (
      this.get("inviteModel") === this.currentUser ||
      emailValid(emailOrUsername)
    );
  },

  // Instructional text for the modal.
  @computed(
    "isPM",
    "invitingToTopic",
    "emailOrUsername",
    "isPrivateTopic",
    "isAdmin",
    "canInviteViaEmail"
  )
  inviteInstructions(
    isPM,
    invitingToTopic,
    emailOrUsername,
    isPrivateTopic,
    isAdmin,
    canInviteViaEmail
  ) {
    if (!canInviteViaEmail) {
      // can't invite via email, only existing users
      return I18n.t("topic.invite_reply.sso_enabled");
    } else if (isPM) {
      // inviting to a message
      return I18n.t("topic.invite_private.email_or_username");
    } else if (invitingToTopic) {
      // inviting to a private/public topic
      if (isPrivateTopic && !isAdmin) {
        // inviting to a private topic and is not admin
        return I18n.t("topic.invite_reply.to_username");
      } else {
        // when inviting to a topic, display instructions based on provided entity
        if (Ember.isEmpty(emailOrUsername)) {
          return I18n.t("topic.invite_reply.to_topic_blank");
        } else if (emailValid(emailOrUsername)) {
          this.set("inviteIcon", "envelope");
          return I18n.t("topic.invite_reply.to_topic_email");
        } else {
          this.set("inviteIcon", "hand-point-right");
          return I18n.t("topic.invite_reply.to_topic_username");
        }
      }
    } else {
      // inviting to forum
      return I18n.t("topic.invite_reply.to_forum");
    }
  },

  @computed("isPrivateTopic")
  showGroupsClass(isPrivateTopic) {
    return isPrivateTopic ? "required" : "optional";
  },

  groupFinder(term) {
    return Group.findAll({ term, ignore_automatic: true });
  },

  @computed("isPM", "emailOrUsername", "invitingExistingUserToTopic")
  successMessage(isPM, emailOrUsername, invitingExistingUserToTopic) {
    if (this.get("hasGroups")) {
      return I18n.t("topic.invite_private.success_group");
    } else if (isPM) {
      return I18n.t("topic.invite_private.success");
    } else if (invitingExistingUserToTopic) {
      return I18n.t("topic.invite_reply.success_existing_email", {
        emailOrUsername
      });
    } else if (emailValid(emailOrUsername)) {
      return I18n.t("topic.invite_reply.success_email", { emailOrUsername });
    } else {
      return I18n.t("topic.invite_reply.success_username");
    }
  },

  @computed("isPM")
  errorMessage(isPM) {
    return isPM
      ? I18n.t("topic.invite_private.error")
      : I18n.t("topic.invite_reply.error");
  },

  @computed("canInviteViaEmail")
  placeholderKey(canInviteViaEmail) {
    return canInviteViaEmail
      ? "topic.invite_private.email_or_username_placeholder"
      : "topic.invite_reply.username_placeholder";
  },

  customMessagePlaceholder: i18n("invite.custom_message_placeholder"),

  // Reset the modal to allow a new user to be invited.
  reset() {
    this.setProperties({
      emailOrUsername: null,
      hasCustomMessage: false,
      customMessage: null,
      invitingExistingUserToTopic: false
    });

    this.get("inviteModel").setProperties({
      groupNames: null,
      error: false,
      saving: false,
      finished: false,
      inviteLink: null
    });
  },

  actions: {
    createInvite() {
      if (this.get("disabled")) {
        return;
      }

      const groupNames = this.get("inviteModel.groupNames");
      const userInvitedController = this.get("userInvitedShow");

      const model = this.get("inviteModel");
      model.setProperties({ saving: true, error: false });

      const onerror = e => {
        if (e.jqXHR.responseJSON && e.jqXHR.responseJSON.errors) {
          this.set("errorMessage", e.jqXHR.responseJSON.errors[0]);
        } else {
          this.set(
            "errorMessage",
            this.get("isPM")
              ? I18n.t("topic.invite_private.error")
              : I18n.t("topic.invite_reply.error")
          );
        }
        model.setProperties({ saving: false, error: true });
      };

      if (this.get("hasGroups")) {
        return this.get("inviteModel")
          .createGroupInvite(this.get("emailOrUsername").trim())
          .then(data => {
            model.setProperties({ saving: false, finished: true });
            this.get("inviteModel.details.allowed_groups").pushObject(
              Ember.Object.create(data.group)
            );
            this.appEvents.trigger("post-stream:refresh");
          })
          .catch(onerror);
      } else {
        return this.get("inviteModel")
          .createInvite(
            this.get("emailOrUsername").trim(),
            groupNames,
            this.get("customMessage")
          )
          .then(result => {
            model.setProperties({ saving: false, finished: true });
            if (!this.get("invitingToTopic") && userInvitedController) {
              Invite.findInvitedBy(
                this.currentUser,
                userInvitedController.get("filter")
              ).then(inviteModel => {
                userInvitedController.setProperties({
                  model: inviteModel,
                  totalInvites: inviteModel.invites.length
                });
              });
            } else if (this.get("isPM") && result && result.user) {
              this.get("inviteModel.details.allowed_users").pushObject(
                Ember.Object.create(result.user)
              );
              this.appEvents.trigger("post-stream:refresh");
            } else if (
              this.get("invitingToTopic") &&
              emailValid(this.get("emailOrUsername").trim()) &&
              result &&
              result.user
            ) {
              this.set("invitingExistingUserToTopic", true);
            }
          })
          .catch(onerror);
      }
    },

    generateInvitelink() {
      if (this.get("disabled")) {
        return;
      }

      const groupNames = this.get("inviteModel.groupNames");
      const userInvitedController = this.get("userInvitedShow");
      const model = this.get("inviteModel");
      model.setProperties({ saving: true, error: false });

      let topicId;
      if (this.get("invitingToTopic")) {
        topicId = this.get("inviteModel.id");
      }

      return model
        .generateInviteLink(
          this.get("emailOrUsername").trim(),
          groupNames,
          topicId
        )
        .then(result => {
          model.setProperties({
            saving: false,
            finished: true,
            inviteLink: result
          });

          if (userInvitedController) {
            Invite.findInvitedBy(
              this.currentUser,
              userInvitedController.get("filter")
            ).then(inviteModel => {
              userInvitedController.setProperties({
                model: inviteModel,
                totalInvites: inviteModel.invites.length
              });
            });
          }
        })
        .catch(e => {
          if (e.jqXHR.responseJSON && e.jqXHR.responseJSON.errors) {
            this.set("errorMessage", e.jqXHR.responseJSON.errors[0]);
          } else {
            this.set(
              "errorMessage",
              this.get("isPM")
                ? I18n.t("topic.invite_private.error")
                : I18n.t("topic.invite_reply.error")
            );
          }
          model.setProperties({ saving: false, error: true });
        });
    },

    showCustomMessageBox() {
      this.toggleProperty("hasCustomMessage");
      if (this.get("hasCustomMessage")) {
        if (this.get("inviteModel") === this.currentUser) {
          this.set(
            "customMessage",
            I18n.t("invite.custom_message_template_forum")
          );
        } else {
          this.set(
            "customMessage",
            I18n.t("invite.custom_message_template_topic")
          );
        }
      } else {
        this.set("customMessage", null);
      }
    }
  }
});
