import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";
import { THEMES, COMPONENTS } from "admin/models/theme";
import { POPULAR_THEMES } from "discourse-common/helpers/popular-themes";

const MIN_NAME_LENGTH = 4;

export default Ember.Controller.extend(ModalFunctionality, {
  popular: Ember.computed.equal("selection", "popular"),
  local: Ember.computed.equal("selection", "local"),
  remote: Ember.computed.equal("selection", "remote"),
  create: Ember.computed.equal("selection", "create"),
  selection: "popular",
  adminCustomizeThemes: Ember.inject.controller(),
  loading: false,
  keyGenUrl: "/admin/themes/generate_key_pair",
  importUrl: "/admin/themes/import",
  recordType: "theme",
  checkPrivate: Ember.computed.match("uploadUrl", /^git/),
  localFile: null,
  uploadUrl: null,
  urlPlaceholder: "https://github.com/discourse/sample_theme",
  advancedVisible: false,
  themesController: Ember.inject.controller("adminCustomizeThemes"),
  selectedType: Ember.computed.alias("themesController.currentTab"),
  component: Ember.computed.equal("selectedType", COMPONENTS),

  init() {
    this._super(...arguments);

    this.createTypes = [
      { name: I18n.t("admin.customize.theme.theme"), value: THEMES },
      { name: I18n.t("admin.customize.theme.component"), value: COMPONENTS }
    ];
  },

  @computed("themesController.installedThemes")
  themes(installedThemes) {
    return POPULAR_THEMES.map(t => {
      if (installedThemes.includes(t.name)) {
        Ember.set(t, "installed", true);
      }
      return t;
    });
  },

  @computed(
    "loading",
    "remote",
    "uploadUrl",
    "local",
    "localFile",
    "create",
    "nameTooShort"
  )
  installDisabled(
    isLoading,
    isRemote,
    uploadUrl,
    isLocal,
    localFile,
    isCreate,
    nameTooShort
  ) {
    return (
      isLoading ||
      (isRemote && !uploadUrl) ||
      (isLocal && !localFile) ||
      (isCreate && nameTooShort)
    );
  },

  @observes("privateChecked")
  privateWasChecked() {
    this.privateChecked
      ? this.set("urlPlaceholder", "git@github.com:discourse/sample_theme.git")
      : this.set("urlPlaceholder", "https://github.com/discourse/sample_theme");

    const checked = this.privateChecked;
    if (checked && !this._keyLoading) {
      this._keyLoading = true;
      ajax(this.keyGenUrl, { method: "POST" })
        .then(pair => {
          this.setProperties({
            privateKey: pair.private_key,
            publicKey: pair.public_key
          });
        })
        .catch(popupAjaxError)
        .finally(() => {
          this._keyLoading = false;
        });
    }
  },

  @computed("name")
  nameTooShort(name) {
    return !name || name.length < MIN_NAME_LENGTH;
  },

  @computed("component")
  placeholder(component) {
    if (component) {
      return I18n.t("admin.customize.theme.component_name");
    } else {
      return I18n.t("admin.customize.theme.theme_name");
    }
  },

  @computed("selection")
  submitLabel(selection) {
    return `admin.customize.theme.${
      selection === "create" ? "create" : "install"
    }`;
  },

  @computed("privateChecked", "checkPrivate", "publicKey")
  showPublicKey(privateChecked, checkPrivate, publicKey) {
    return privateChecked && checkPrivate && publicKey;
  },

  actions: {
    uploadLocaleFile() {
      this.set("localFile", $("#file-input")[0].files[0]);
    },

    toggleAdvanced() {
      this.toggleProperty("advancedVisible");
    },

    installThemeFromList(url) {
      this.set("uploadUrl", url);
      this.send("installTheme");
    },

    installTheme() {
      if (this.create) {
        this.set("loading", true);
        const theme = this.store.createRecord(this.recordType);
        theme
          .save({ name: this.name, component: this.component })
          .then(() => {
            this.themesController.send("addTheme", theme);
            this.send("closeModal");
          })
          .catch(popupAjaxError)
          .finally(() => this.set("loading", false));

        return;
      }

      let options = {
        type: "POST"
      };

      if (this.local) {
        options.processData = false;
        options.contentType = false;
        options.data = new FormData();
        options.data.append("theme", this.localFile);
      }

      if (this.remote || this.popular) {
        options.data = {
          remote: this.uploadUrl,
          branch: this.branch
        };

        if (this.privateChecked) {
          options.data.private_key = this.privateKey;
        }
      }

      if (this.get("model.user_id")) {
        // Used by theme-creator
        options.data["user_id"] = this.get("model.user_id");
      }

      this.set("loading", true);
      ajax(this.importUrl, options)
        .then(result => {
          const theme = this.store.createRecord(this.recordType, result.theme);
          this.adminCustomizeThemes.send("addTheme", theme);
          this.send("closeModal");
        })
        .then(() => {
          this.setProperties({ privateKey: null, publicKey: null });
        })
        .catch(popupAjaxError)
        .finally(() => this.set("loading", false));
    }
  }
});
