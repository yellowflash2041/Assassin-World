import discourseComputed, {
  observes,
  on,
} from "discourse-common/utils/decorators";
import Category from "discourse/models/category";
import Component from "@ember/component";
import I18n from "I18n";
import bootbox from "bootbox";
import { bufferedProperty } from "discourse/mixins/buffered-content";
import { isEmpty } from "@ember/utils";
import { or } from "@ember/object/computed";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { schedule } from "@ember/runloop";

export default Component.extend(bufferedProperty("host"), {
  editToggled: false,
  tagName: "tr",
  categoryId: null,

  editing: or("host.isNew", "editToggled"),

  @on("didInsertElement")
  @observes("editing")
  _focusOnInput() {
    schedule("afterRender", () => {
      this.element.querySelector(".host-name").focus();
    });
  },

  @discourseComputed("buffered.host", "host.isSaving")
  cantSave(host, isSaving) {
    return isSaving || isEmpty(host);
  },

  actions: {
    edit() {
      this.set("categoryId", this.get("host.category.id"));
      this.set("editToggled", true);
    },

    save() {
      if (this.cantSave) {
        return;
      }

      const props = this.buffered.getProperties(
        "host",
        "allowed_paths",
        "class_name"
      );
      props.category_id = this.categoryId;

      const host = this.host;

      host
        .save(props)
        .then(() => {
          host.set("category", Category.findById(this.categoryId));
          this.set("editToggled", false);
        })
        .catch(popupAjaxError);
    },

    delete() {
      bootbox.confirm(I18n.t("admin.embedding.confirm_delete"), (result) => {
        if (result) {
          this.host.destroyRecord().then(() => {
            this.deleteHost(this.host);
          });
        }
      });
    },

    cancel() {
      const host = this.host;
      if (host.get("isNew")) {
        this.deleteHost(host);
      } else {
        this.rollbackBuffer();
        this.set("editToggled", false);
      }
    },
  },
});
