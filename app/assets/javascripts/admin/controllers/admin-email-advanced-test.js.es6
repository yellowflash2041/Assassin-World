import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Ember.Controller.extend({
  email: null,
  text: null,
  elided: null,
  format: null,
  loading: null,

  actions: {
    run() {
      this.set("loading", true);

      ajax("/admin/email/advanced-test", {
        type: "POST",
        data: { email: this.get("email") }
      })
        .then(data => {
          this.setProperties({
            text: data.text,
            elided: data.elided,
            format: data.format
          });
        })
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    }
  }
});
