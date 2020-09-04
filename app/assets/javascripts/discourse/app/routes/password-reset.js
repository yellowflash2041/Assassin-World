import I18n from "I18n";
import DiscourseRoute from "discourse/routes/discourse";
import PreloadStore from "discourse/lib/preload-store";
import { ajax } from "discourse/lib/ajax";
import { userPath } from "discourse/lib/url";
import { deepMerge } from "discourse-common/lib/object";

export default DiscourseRoute.extend({
  titleToken() {
    return I18n.t("login.reset_password");
  },

  model(params) {
    if (PreloadStore.get("password_reset")) {
      return PreloadStore.getAndRemove("password_reset").then((json) =>
        deepMerge(params, json)
      );
    }
  },

  afterModel(model) {
    // confirm token here so email clients who crawl URLs don't invalidate the link
    if (model) {
      return ajax({
        url: userPath(`confirm-email-token/${model.token}.json`),
        dataType: "json",
      });
    }
  },
});
