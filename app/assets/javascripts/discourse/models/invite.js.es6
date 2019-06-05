import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { userPath } from "discourse/lib/url";

const Invite = Discourse.Model.extend({
  rescind() {
    ajax("/invites", {
      type: "DELETE",
      data: { email: this.email }
    });
    this.set("rescinded", true);
  },

  reinvite() {
    return ajax("/invites/reinvite", {
      type: "POST",
      data: { email: this.email }
    })
      .then(() => this.set("reinvited", true))
      .catch(popupAjaxError);
  }
});

Invite.reopenClass({
  create() {
    const result = this._super.apply(this, arguments);
    if (result.user) {
      result.user = Discourse.User.create(result.user);
    }
    return result;
  },

  findInvitedBy(user, filter, search, offset) {
    if (!user) Ember.RSVP.resolve();

    const data = {};
    if (!Ember.isNone(filter)) data.filter = filter;
    if (!Ember.isNone(search)) data.search = search;
    data.offset = offset || 0;

    return ajax(userPath(`${user.username_lower}/invited.json`), {
      data
    }).then(result => {
      result.invites = result.invites.map(i => Invite.create(i));
      return Ember.Object.create(result);
    });
  },

  findInvitedCount(user) {
    if (!user) Ember.RSVP.resolve();

    return ajax(userPath(`${user.username_lower}/invited_count.json`)).then(
      result => Ember.Object.create(result.counts)
    );
  },

  reinviteAll() {
    return ajax("/invites/reinvite-all", { type: "POST" });
  },

  rescindAll() {
    return ajax("/invites/rescind-all", { type: "POST" });
  }
});

export default Invite;
