import PreferencesTabController from "discourse/mixins/preferences-tab-controller";
import { setDefaultHomepage } from "discourse/lib/utilities";
import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";
import {
  listThemes,
  previewTheme,
  setLocalTheme
} from "discourse/lib/theme-selector";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { safariHacksDisabled, isiPad } from "discourse/lib/utilities";

const USER_HOMES = {
  1: "latest",
  2: "categories",
  3: "unread",
  4: "new",
  5: "top"
};

const TEXT_SIZES = ["smaller", "normal", "larger", "largest"];

export default Ember.Controller.extend(PreferencesTabController, {
  @computed("makeThemeDefault")
  saveAttrNames(makeDefault) {
    let attrs = [
      "locale",
      "external_links_in_new_tab",
      "dynamic_favicon",
      "enable_quoting",
      "disable_jump_reply",
      "automatically_unpin_topics",
      "allow_private_messages",
      "homepage_id",
      "hide_profile_and_presence",
      "text_size"
    ];

    if (makeDefault) {
      attrs.push("theme_ids");
    }

    return attrs;
  },

  preferencesController: Ember.inject.controller("preferences"),

  @computed()
  isiPad() {
    return isiPad();
  },

  @computed()
  disableSafariHacks() {
    return safariHacksDisabled();
  },

  @computed()
  availableLocales() {
    return JSON.parse(this.siteSettings.available_locales);
  },

  @computed
  textSizes() {
    return TEXT_SIZES.map(value => {
      return { name: I18n.t(`user.text_size.${value}`), value };
    });
  },

  userSelectableThemes: function() {
    return listThemes(this.site);
  }.property(),

  @computed("userSelectableThemes")
  showThemeSelector(themes) {
    return themes && themes.length > 1;
  },

  @observes("themeId")
  themeIdChanged() {
    const id = this.get("themeId");
    previewTheme([id]);
  },

  @computed("model.user_option.theme_ids", "themeId")
  showThemeSetDefault(userOptionThemes, selectedTheme) {
    return !userOptionThemes || userOptionThemes[0] !== selectedTheme;
  },

  @computed("model.user_option.text_size", "textSize")
  showTextSetDefault(userOptionTextSize, selectedTextSize) {
    return userOptionTextSize !== selectedTextSize;
  },

  homeChanged() {
    const siteHome = this.siteSettings.top_menu.split("|")[0].split(",")[0];
    const userHome = USER_HOMES[this.get("model.user_option.homepage_id")];

    setDefaultHomepage(userHome || siteHome);
  },

  @computed()
  userSelectableHome() {
    let homeValues = _.invert(USER_HOMES);

    let result = [];
    this.siteSettings.top_menu.split("|").forEach(m => {
      let id = homeValues[m];
      if (id) {
        result.push({ name: I18n.t(`filters.${m}.title`), value: Number(id) });
      }
    });
    return result;
  },

  actions: {
    save() {
      this.set("saved", false);
      const makeThemeDefault = this.get("makeThemeDefault");
      if (makeThemeDefault) {
        this.set("model.user_option.theme_ids", [this.get("themeId")]);
      }

      const makeTextSizeDefault = this.get("makeTextSizeDefault");
      if (makeTextSizeDefault) {
        this.set("model.user_option.text_size", this.get("textSize"));
      }

      return this.get("model")
        .save(this.get("saveAttrNames"))
        .then(() => {
          this.set("saved", true);

          if (makeThemeDefault) {
            setLocalTheme([]);
          } else {
            setLocalTheme(
              [this.get("themeId")],
              this.get("model.user_option.theme_key_seq")
            );
          }
          if (makeTextSizeDefault) {
            this.get("model").updateTextSizeCookie(null);
          } else {
            this.get("model").updateTextSizeCookie(this.get("textSize"));
          }

          this.homeChanged();

          if (this.get("isiPad")) {
            if (safariHacksDisabled() !== this.get("disableSafariHacks")) {
              Discourse.set("assetVersion", "forceRefresh");
            }
            localStorage.setItem(
              "safari-hacks-disabled",
              this.get("disableSafariHacks").toString()
            );
          }
        })
        .catch(popupAjaxError);
    },

    selectTextSize(newSize) {
      const classList = document.documentElement.classList;

      TEXT_SIZES.forEach(name => {
        const className = `text-size-${name}`;
        if (newSize === name) {
          classList.add(className);
        } else {
          classList.remove(className);
        }
      });

      // Force refresh when leaving this screen
      Discourse.set("assetVersion", "forceRefresh");
    }
  }
});
