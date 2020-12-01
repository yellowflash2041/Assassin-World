import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { equal, reads } from "@ember/object/computed";
import Controller from "@ember/controller";
import I18n from "I18n";
import { INPUT_DELAY } from "discourse-common/config/environment";
import Invite from "discourse/models/invite";
import bootbox from "bootbox";
import discourseDebounce from "discourse/lib/debounce";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Controller.extend({
  user: null,
  model: null,
  filter: null,
  totalInvites: null,
  invitesCount: null,
  canLoadMore: true,
  invitesLoading: false,
  reinvitedAll: false,
  rescindedAll: false,
  searchTerm: null,

  init() {
    this._super(...arguments);
    this.set("searchTerm", "");
  },

  @observes("searchTerm")
  _searchTermChanged: discourseDebounce(function () {
    Invite.findInvitedBy(
      this.user,
      this.filter,
      this.searchTerm
    ).then((invites) => this.set("model", invites));
  }, INPUT_DELAY),

  inviteRedeemed: equal("filter", "redeemed"),
  invitePending: equal("filter", "pending"),

  @discourseComputed("filter")
  inviteLinks(filter) {
    return filter === "links" && this.currentUser.staff;
  },

  @discourseComputed("filter")
  showBulkActionButtons(filter) {
    return (
      filter === "pending" &&
      this.model.invites.length > 4 &&
      this.currentUser.staff
    );
  },

  canInviteToForum: reads("currentUser.can_invite_to_forum"),
  canBulkInvite: reads("currentUser.admin"),
  canSendInviteLink: reads("currentUser.staff"),

  @discourseComputed("totalInvites", "inviteLinks")
  showSearch(totalInvites, inviteLinks) {
    return totalInvites >= 10 && !inviteLinks;
  },

  @discourseComputed("invitesCount.total", "invitesCount.pending")
  pendingLabel(invitesCountTotal, invitesCountPending) {
    if (invitesCountTotal > 50) {
      return I18n.t("user.invited.pending_tab_with_count", {
        count: invitesCountPending,
      });
    } else {
      return I18n.t("user.invited.pending_tab");
    }
  },

  @discourseComputed("invitesCount.total", "invitesCount.redeemed")
  redeemedLabel(invitesCountTotal, invitesCountRedeemed) {
    if (invitesCountTotal > 50) {
      return I18n.t("user.invited.redeemed_tab_with_count", {
        count: invitesCountRedeemed,
      });
    } else {
      return I18n.t("user.invited.redeemed_tab");
    }
  },

  @discourseComputed("invitesCount.total", "invitesCount.links")
  linksLabel(invitesCountTotal, invitesCountLinks) {
    if (invitesCountTotal > 50) {
      return I18n.t("user.invited.links_tab_with_count", {
        count: invitesCountLinks,
      });
    } else {
      return I18n.t("user.invited.links_tab");
    }
  },

  actions: {
    rescind(invite) {
      invite.rescind();
      return false;
    },

    rescindAll() {
      bootbox.confirm(I18n.t("user.invited.rescind_all_confirm"), (confirm) => {
        if (confirm) {
          Invite.rescindAll()
            .then(() => {
              this.set("rescindedAll", true);
            })
            .catch(popupAjaxError);
        }
      });
    },

    reinvite(invite) {
      invite.reinvite();
      return false;
    },

    reinviteAll() {
      bootbox.confirm(
        I18n.t("user.invited.reinvite_all_confirm"),
        (confirm) => {
          if (confirm) {
            Invite.reinviteAll()
              .then(() => this.set("reinvitedAll", true))
              .catch(popupAjaxError);
          }
        }
      );
    },

    loadMore() {
      const model = this.model;

      if (this.canLoadMore && !this.invitesLoading) {
        this.set("invitesLoading", true);
        Invite.findInvitedBy(
          this.user,
          this.filter,
          this.searchTerm,
          model.invites.length
        ).then((invite_model) => {
          this.set("invitesLoading", false);
          model.invites.pushObjects(invite_model.invites);
          if (
            invite_model.invites.length === 0 ||
            invite_model.invites.length < this.siteSettings.invites_per_page
          ) {
            this.set("canLoadMore", false);
          }
        });
      }
    },
  },
});
