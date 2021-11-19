import Controller from "@ember/controller";
import { action } from "@ember/object";
import { getAbsoluteURL } from "discourse-common/lib/get-url";
import discourseComputed from "discourse-common/utils/decorators";
import { ajax } from "discourse/lib/ajax";
import { extractError } from "discourse/lib/ajax-error";
import Sharing from "discourse/lib/sharing";
import showModal from "discourse/lib/show-modal";
import { bufferedProperty } from "discourse/mixins/buffered-content";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import I18n from "I18n";
import Category from "discourse/models/category";

export default Controller.extend(
  ModalFunctionality,
  bufferedProperty("invite"),
  {
    topic: null,
    restrictedGroups: null,

    onShow() {
      this.set("showNotifyUsers", false);

      if (this.model && this.model.read_restricted) {
        this.restrictedGroupWarning();
      }
    },

    @discourseComputed("topic.shareUrl")
    topicUrl(url) {
      return url ? getAbsoluteURL(url) : null;
    },

    @discourseComputed(
      "topic.{isPrivateMessage,invisible,category.read_restricted}"
    )
    sources(topic) {
      const privateContext =
        this.siteSettings.login_required ||
        (topic && topic.isPrivateMessage) ||
        (topic && topic.invisible) ||
        topic.category.read_restricted;

      return Sharing.activeSources(
        this.siteSettings.share_links,
        privateContext
      );
    },

    @action
    onChangeUsers(usernames) {
      this.set("users", usernames.uniq());
    },

    @action
    share(source) {
      this.set("showNotifyUsers", false);
      Sharing.shareSource(source, {
        title: this.topic.title,
        url: this.topicUrl,
      });
    },

    @action
    toggleNotifyUsers() {
      if (this.showNotifyUsers) {
        this.set("showNotifyUsers", false);
      } else {
        this.setProperties({
          showNotifyUsers: true,
          users: [],
        });
      }
    },

    @action
    notifyUsers() {
      if (this.users.length === 0) {
        return;
      }

      ajax(`/t/${this.topic.id}/invite-notify`, {
        type: "POST",
        data: { usernames: this.users },
      })
        .then(() => {
          this.setProperties({ showNotifyUsers: false });
          this.appEvents.trigger("modal-body:flash", {
            text: I18n.t("topic.share.notify_users.success", {
              count: this.users.length,
              username: this.users[0],
            }),
            messageClass: "success",
          });
        })
        .catch((error) => {
          this.appEvents.trigger("modal-body:flash", {
            text: extractError(error),
            messageClass: "error",
          });
        });
    },

    @action
    inviteUsers() {
      this.set("showNotifyUsers", false);
      const controller = showModal("create-invite");
      controller.set("inviteToTopic", true);
      controller.buffered.setProperties({
        topicId: this.topic.id,
        topicTitle: this.topic.title,
      });
    },

    restrictedGroupWarning() {
      this.appEvents.on("modal:body-shown", () => {
        let restrictedGroups;
        Category.reloadBySlugPath(this.model.slug).then((result) => {
          restrictedGroups = result.category.group_permissions.map(
            (g) => g.group_name
          );

          if (restrictedGroups) {
            const message = I18n.t("topic.share.restricted_groups", {
              count: restrictedGroups.length,
              groupNames: restrictedGroups.join(", "),
            });
            this.flash(message, "warning");
          }
        });
      });
    },
  }
);
