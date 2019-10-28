import Component from "@ember/component";
import BufferedContent from "discourse/mixins/buffered-content";
import SettingComponent from "admin/mixins/setting-component";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default Component.extend(BufferedContent, SettingComponent, {
  layoutName: "admin/templates/components/site-setting",

  _save(callback) {
    callback(
      ajax(`/admin/themes/${this.model.id}/setting`, {
        type: "PUT",
        data: {
          name: this.setting.setting,
          value: this.get("buffered.value")
        }
      }).catch(popupAjaxError)
    );
  }
});
