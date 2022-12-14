import { ensureJSON, plainJSON, prettyJSON } from "discourse/lib/formatter";
import Component from "@ember/component";
import I18n from "I18n";
import { ajax } from "discourse/lib/ajax";
import discourseComputed from "discourse-common/utils/decorators";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "li",
  expandDetails: null,
  expandDetailsRequestKey: "request",
  expandDetailsResponseKey: "response",
  dialog: service(),

  @discourseComputed("model.status")
  statusColorClasses(status) {
    if (!status) {
      return "";
    }

    if (status >= 200 && status <= 299) {
      return "text-successful";
    } else {
      return "text-danger";
    }
  },

  @discourseComputed("model.created_at")
  createdAt(createdAt) {
    return moment(createdAt).format("YYYY-MM-DD HH:mm:ss");
  },

  @discourseComputed("model.duration")
  completion(duration) {
    const seconds = Math.floor(duration / 10.0) / 100.0;
    return I18n.t("admin.web_hooks.events.completed_in", { count: seconds });
  },

  @discourseComputed("expandDetails")
  expandRequestIcon(expandDetails) {
    return expandDetails === this.expandDetailsRequestKey
      ? "ellipsis-h"
      : "ellipsis-v";
  },

  @discourseComputed("expandDetails")
  expandResponseIcon(expandDetails) {
    return expandDetails === this.expandDetailsResponseKey
      ? "ellipsis-h"
      : "ellipsis-v";
  },

  actions: {
    redeliver() {
      return this.dialog.yesNoConfirm({
        message: I18n.t("admin.web_hooks.events.redeliver_confirm"),
        didConfirm: () => {
          return ajax(
            `/admin/api/web_hooks/${this.get(
              "model.web_hook_id"
            )}/events/${this.get("model.id")}/redeliver`,
            { type: "POST" }
          )
            .then((json) => {
              this.set("model", json.web_hook_event);
            })
            .catch(popupAjaxError);
        },
      });
    },

    toggleRequest() {
      const expandDetailsKey = this.expandDetailsRequestKey;

      if (this.expandDetails !== expandDetailsKey) {
        let headers = Object.assign(
          {
            "Request URL": this.get("model.request_url"),
            "Request method": "POST",
          },
          ensureJSON(this.get("model.headers"))
        );
        this.setProperties({
          headers: plainJSON(headers),
          body: prettyJSON(this.get("model.payload")),
          expandDetails: expandDetailsKey,
          bodyLabel: I18n.t("admin.web_hooks.events.payload"),
        });
      } else {
        this.set("expandDetails", null);
      }
    },

    toggleResponse() {
      const expandDetailsKey = this.expandDetailsResponseKey;

      if (this.expandDetails !== expandDetailsKey) {
        this.setProperties({
          headers: plainJSON(this.get("model.response_headers")),
          body: this.get("model.response_body"),
          expandDetails: expandDetailsKey,
          bodyLabel: I18n.t("admin.web_hooks.events.body"),
        });
      } else {
        this.set("expandDetails", null);
      }
    },
  },
});
