import { alias, oneWay } from "@ember/object/computed";
import computed from "ember-addons/ember-computed-decorators";
import { categoryLinkHTML } from "discourse/helpers/category-link";
import { on } from "@ember/object/evented";
import Mixin from "@ember/object/mixin";
import showModal from "discourse/lib/show-modal";
import AboutRoute from "discourse/routes/about";
import { Promise } from "rsvp";

const CUSTOM_TYPES = [
  "bool",
  "enum",
  "list",
  "url_list",
  "host_list",
  "category_list",
  "value_list",
  "category",
  "uploaded_image_list",
  "compact_list",
  "secret_list",
  "upload",
  "group_list",
  "tag_list"
];

const AUTO_REFRESH_ON_SAVE = ["logo", "logo_small", "large_icon"];

export default Mixin.create({
  classNameBindings: [":row", ":setting", "overridden", "typeClass"],
  content: alias("setting"),
  validationMessage: null,
  isSecret: oneWay("setting.secret"),

  @computed("buffered.value", "setting.value")
  dirty(bufferVal, settingVal) {
    if (bufferVal === null || bufferVal === undefined) bufferVal = "";
    if (settingVal === null || settingVal === undefined) settingVal = "";

    return bufferVal.toString() !== settingVal.toString();
  },

  @computed("setting", "buffered.value")
  preview(setting, value) {
    // A bit hacky, but allows us to use helpers
    if (setting.get("setting") === "category_style") {
      let category = this.site.get("categories.firstObject");
      if (category) {
        return categoryLinkHTML(category, {
          categoryStyle: value
        });
      }
    }

    let preview = setting.get("preview");
    if (preview) {
      return new Handlebars.SafeString(
        "<div class='preview'>" +
          preview.replace(/\{\{value\}\}/g, value) +
          "</div>"
      );
    }
  },

  @computed("componentType")
  typeClass(componentType) {
    return componentType.replace(/\_/g, "-");
  },

  @computed("setting.setting")
  settingName(setting) {
    return setting.replace(/\_/g, " ");
  },

  @computed("type")
  componentType(type) {
    return CUSTOM_TYPES.indexOf(type) !== -1 ? type : "string";
  },

  @computed("setting")
  type(setting) {
    if (setting.type === "list" && setting.list_type) {
      return `${setting.list_type}_list`;
    }

    return setting.type;
  },

  @computed("typeClass")
  componentName(typeClass) {
    return "site-settings/" + typeClass;
  },

  @computed("setting.default", "buffered.value")
  overridden(settingDefault, bufferedValue) {
    return settingDefault !== bufferedValue;
  },

  _watchEnterKey: on("didInsertElement", function() {
    $(this.element).on("keydown.setting-enter", ".input-setting-string", e => {
      if (e.keyCode === 13) {
        // enter key
        this.send("save");
      }
    });
  }),

  _removeBindings: on("willDestroyElement", function() {
    $(this.element).off("keydown.setting-enter");
  }),

  _save() {
    Ember.warn("You should define a `_save` method", {
      id: "discourse.setting-component.missing-save"
    });
    return Promise.resolve();
  },

  actions: {
    update() {
      const defaultUserPreferences = [
        "default_email_digest_frequency",
        "default_include_tl0_in_digests",
        "default_email_level",
        "default_email_messages_level",
        "default_email_mailing_list_mode",
        "default_email_mailing_list_mode_frequency",
        "disable_mailing_list_mode",
        "default_email_previous_replies",
        "default_email_in_reply_to",
        "default_other_new_topic_duration_minutes",
        "default_other_auto_track_topics_after_msecs",
        "default_other_notification_level_when_replying",
        "default_other_external_links_in_new_tab",
        "default_other_enable_quoting",
        "default_other_enable_defer",
        "default_other_dynamic_favicon",
        "default_other_like_notification_frequency",
        "default_topics_automatic_unpin",
        "default_categories_watching",
        "default_categories_tracking",
        "default_categories_muted",
        "default_categories_watching_first_post",
        "default_tags_watching",
        "default_tags_tracking",
        "default_tags_muted",
        "default_tags_watching_first_post",
        "default_text_size",
        "default_title_count_mode"
      ];
      const key = this.buffered.get("setting");

      if (defaultUserPreferences.includes(key)) {
        AboutRoute.create()
          .model()
          .then(result => {
            const controller = showModal("site-setting-default-categories", {
              model: {
                count: result.stats.user_count,
                key: key.replace(/_/g, " ")
              },
              admin: true
            });

            controller.set("onClose", () => {
              this.updateExistingUsers = controller.updateExistingUsers;
              this.send("save");
            });
          });
      } else {
        this.send("save");
      }
    },

    save() {
      this._save()
        .then(() => {
          this.set("validationMessage", null);
          this.commitBuffer();
          if (AUTO_REFRESH_ON_SAVE.includes(this.setting.setting)) {
            this.afterSave();
          }
        })
        .catch(e => {
          if (e.jqXHR.responseJSON && e.jqXHR.responseJSON.errors) {
            this.set("validationMessage", e.jqXHR.responseJSON.errors[0]);
          } else {
            this.set("validationMessage", I18n.t("generic_error"));
          }
        });
    },

    cancel() {
      this.rollbackBuffer();
    },

    resetDefault() {
      this.set("buffered.value", this.get("setting.default"));
    },

    toggleSecret() {
      this.toggleProperty("isSecret");
    }
  }
});
