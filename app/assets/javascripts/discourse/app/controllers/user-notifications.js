import Controller, { inject as controller } from "@ember/controller";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { ajax } from "discourse/lib/ajax";
import { readOnly } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default Controller.extend({
  application: controller(),
  queryParams: ["filter"],
  router: service(),
  currentPath: readOnly("router._router.currentPath"),
  filter: "all",

  @observes("model.canLoadMore")
  _showFooter() {
    this.set("application.showFooter", !this.get("model.canLoadMore"));
  },

  @discourseComputed("model.content.length")
  hasFilteredNotifications(length) {
    return length > 0;
  },

  @discourseComputed("model.content.@each.read")
  allNotificationsRead() {
    return !this.get("model.content").some(
      (notification) => !notification.get("read")
    );
  },

  actions: {
    resetNew() {
      ajax("/notifications/mark-read", { type: "PUT" }).then(() => {
        this.model.forEach((n) => n.set("read", true));
      });
    },

    loadMore() {
      this.model.loadMore();
    },
  },
});
