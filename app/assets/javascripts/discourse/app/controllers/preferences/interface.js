import I18n from "I18n";
import Controller, { inject } from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import { listThemes, setLocalTheme } from "discourse/lib/theme-selector";
import {
  listColorSchemes,
  loadColorSchemeStylesheet,
  updateColorSchemeCookie,
} from "discourse/lib/color-scheme-picker";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { reload } from "discourse/helpers/page-reloader";
import {
  safariHacksDisabled,
  isiPad,
  iOSWithVisualViewport,
  setDefaultHomepage,
} from "discourse/lib/utilities";
import { computed } from "@ember/object";
import { reads } from "@ember/object/computed";

const USER_HOMES = {
  1: "latest",
  2: "categories",
  3: "unread",
  4: "new",
  5: "top",
  6: "bookmarks",
};

const TEXT_SIZES = ["smallest", "smaller", "normal", "larger", "largest"];
const TITLE_COUNT_MODES = ["notifications", "contextual"];

export default Controller.extend({
  currentThemeId: -1,
  previewingColorScheme: false,
  selectedColorSchemeId: null,
  selectedDarkColorSchemeId: null,
  preferencesController: inject("preferences"),
  makeColorSchemeDefault: true,

  init() {
    this._super(...arguments);

    this.setProperties({
      selectedColorSchemeId: this.session.userColorSchemeId,
      selectedDarkColorSchemeId: this.session.userDarkSchemeId,
    });
  },

  @discourseComputed("makeThemeDefault")
  saveAttrNames(makeThemeDefault) {
    let attrs = [
      "locale",
      "external_links_in_new_tab",
      "dynamic_favicon",
      "enable_quoting",
      "enable_defer",
      "automatically_unpin_topics",
      "allow_private_messages",
      "enable_allowed_pm_users",
      "homepage_id",
      "hide_profile_and_presence",
      "text_size",
      "title_count_mode",
      "skip_new_user_tips",
      "color_scheme_id",
      "dark_scheme_id",
    ];

    if (makeThemeDefault) {
      attrs.push("theme_ids");
    }

    return attrs;
  },

  @discourseComputed()
  isiPad() {
    // TODO: remove this preference checkbox when iOS adoption > 90%
    // (currently only applies to iOS 12 and below)
    return isiPad() && !iOSWithVisualViewport();
  },

  @discourseComputed()
  disableSafariHacks() {
    return safariHacksDisabled();
  },

  @discourseComputed()
  availableLocales() {
    return JSON.parse(this.siteSettings.available_locales);
  },

  @discourseComputed
  defaultDarkSchemeId() {
    return this.siteSettings.default_dark_mode_color_scheme_id;
  },

  @discourseComputed
  textSizes() {
    return TEXT_SIZES.map((value) => {
      return { name: I18n.t(`user.text_size.${value}`), value };
    });
  },

  homepageId: computed(
    "model.user_option.homepage_id",
    "userSelectableHome.[]",
    function () {
      return (
        this.model.user_option.homepage_id ||
        this.userSelectableHome.firstObject.value
      );
    }
  ),

  @discourseComputed
  titleCountModes() {
    return TITLE_COUNT_MODES.map((value) => {
      return { name: I18n.t(`user.title_count_mode.${value}`), value };
    });
  },

  @discourseComputed
  userSelectableThemes() {
    return listThemes(this.site);
  },

  @discourseComputed("userSelectableThemes")
  showThemeSelector(themes) {
    return themes && themes.length > 1;
  },

  @discourseComputed("themeId")
  themeIdChanged(themeId) {
    if (this.currentThemeId === -1) {
      this.set("currentThemeId", themeId);
      return false;
    } else {
      return this.currentThemeId !== themeId;
    }
  },

  @discourseComputed
  userSelectableColorSchemes() {
    return listColorSchemes(this.site);
  },

  showColorSchemeSelector: reads("userSelectableColorSchemes.length"),
  selectedColorSchemeNoneLabel: I18n.t(
    "user.color_schemes.default_description"
  ),

  @discourseComputed("model.user_option.theme_ids", "themeId")
  showThemeSetDefault(userOptionThemes, selectedTheme) {
    return !userOptionThemes || userOptionThemes[0] !== selectedTheme;
  },

  @discourseComputed("model.user_option.text_size", "textSize")
  showTextSetDefault(userOptionTextSize, selectedTextSize) {
    return userOptionTextSize !== selectedTextSize;
  },

  homeChanged() {
    const siteHome = this.siteSettings.top_menu.split("|")[0].split(",")[0];
    const userHome = USER_HOMES[this.get("model.user_option.homepage_id")];

    setDefaultHomepage(userHome || siteHome);
  },

  @discourseComputed()
  userSelectableHome() {
    let homeValues = {};
    Object.keys(USER_HOMES).forEach((newValue) => {
      const newKey = USER_HOMES[newValue];
      homeValues[newKey] = newValue;
    });

    let result = [];
    this.siteSettings.top_menu.split("|").forEach((m) => {
      let id = homeValues[m];
      if (id) {
        result.push({ name: I18n.t(`filters.${m}.title`), value: Number(id) });
      }
    });
    return result;
  },

  @discourseComputed
  showDarkModeToggle() {
    return this.defaultDarkSchemeId > 0 && !this.showDarkColorSchemeSelector;
  },

  @discourseComputed
  userSelectableDarkColorSchemes() {
    return listColorSchemes(this.site, {
      darkOnly: true,
    });
  },

  @discourseComputed("userSelectableDarkColorSchemes")
  showDarkColorSchemeSelector(darkSchemes) {
    // when a default dark scheme is set
    // dropdown has two items (disable / use site default)
    // but we show a checkbox in that case
    const minToShow = this.defaultDarkSchemeId > 0 ? 2 : 1;
    return darkSchemes && darkSchemes.length > minToShow;
  },

  enableDarkMode: computed({
    set(key, value) {
      return value;
    },
    get() {
      return this.get("model.user_option.dark_scheme_id") === -1 ? false : true;
    },
  }),

  actions: {
    save() {
      this.set("saved", false);
      const makeThemeDefault = this.makeThemeDefault;
      if (makeThemeDefault) {
        this.set("model.user_option.theme_ids", [this.themeId]);
      }

      const makeTextSizeDefault = this.makeTextSizeDefault;
      if (makeTextSizeDefault) {
        this.set("model.user_option.text_size", this.textSize);
      }

      if (!this.showColorSchemeSelector) {
        this.set("model.user_option.color_scheme_id", null);
      } else if (this.makeColorSchemeDefault) {
        this.set(
          "model.user_option.color_scheme_id",
          this.selectedColorSchemeId
        );
      }

      if (this.showDarkModeToggle) {
        this.set(
          "model.user_option.dark_scheme_id",
          this.enableDarkMode ? null : -1
        );
      } else {
        // if chosen dark scheme matches site dark scheme, no need to store
        if (
          this.defaultDarkSchemeId > 0 &&
          this.selectedDarkColorSchemeId === this.defaultDarkSchemeId
        ) {
          this.set("model.user_option.dark_scheme_id", null);
        } else {
          this.set(
            "model.user_option.dark_scheme_id",
            this.selectedDarkColorSchemeId
          );
        }
      }

      return this.model
        .save(this.saveAttrNames)
        .then(() => {
          this.set("saved", true);

          if (makeThemeDefault) {
            setLocalTheme([]);
          } else {
            setLocalTheme(
              [this.themeId],
              this.get("model.user_option.theme_key_seq")
            );
          }
          if (makeTextSizeDefault) {
            this.model.updateTextSizeCookie(null);
          } else {
            this.model.updateTextSizeCookie(this.textSize);
          }

          if (this.makeColorSchemeDefault) {
            updateColorSchemeCookie(null);
            updateColorSchemeCookie(null, { dark: true });
          } else {
            updateColorSchemeCookie(this.selectedColorSchemeId);

            if (
              this.defaultDarkSchemeId > 0 &&
              this.selectedDarkColorSchemeId === this.defaultDarkSchemeId
            ) {
              updateColorSchemeCookie(null, { dark: true });
            } else {
              updateColorSchemeCookie(this.selectedDarkColorSchemeId, {
                dark: true,
              });
            }
          }

          this.homeChanged();

          if (this.isiPad) {
            if (safariHacksDisabled() !== this.disableSafariHacks) {
              this.session.requiresRefresh = true;
            }
            localStorage.setItem(
              "safari-hacks-disabled",
              this.disableSafariHacks.toString()
            );
          }

          if (this.themeId !== this.currentThemeId) {
            reload();
          }
        })
        .catch(popupAjaxError);
    },

    selectTextSize(newSize) {
      const classList = document.documentElement.classList;

      TEXT_SIZES.forEach((name) => {
        const className = `text-size-${name}`;
        if (newSize === name) {
          classList.add(className);
        } else {
          classList.remove(className);
        }
      });

      // Force refresh when leaving this screen
      this.session.requiresRefresh = true;
      this.set("textSize", newSize);
    },

    loadColorScheme(colorSchemeId) {
      this.setProperties({
        selectedColorSchemeId: colorSchemeId,
        previewingColorScheme: true,
      });

      if (colorSchemeId < 0) {
        const defaultTheme = this.userSelectableThemes.findBy(
          "id",
          this.themeId
        );

        if (defaultTheme && defaultTheme.color_scheme_id) {
          colorSchemeId = defaultTheme.color_scheme_id;
        }
      }
      loadColorSchemeStylesheet(colorSchemeId, this.themeId);
      if (this.selectedDarkColorSchemeId === -1) {
        // set this same scheme for dark mode preview when dark scheme is disabled
        loadColorSchemeStylesheet(colorSchemeId, this.themeId, true);
      }
    },

    loadDarkColorScheme(colorSchemeId) {
      this.setProperties({
        selectedDarkColorSchemeId: colorSchemeId,
        previewingColorScheme: true,
      });

      if (colorSchemeId === -1) {
        // load preview of regular scheme when dark scheme is disabled
        loadColorSchemeStylesheet(
          this.selectedColorSchemeId,
          this.themeId,
          true
        );
      } else {
        loadColorSchemeStylesheet(colorSchemeId, this.themeId, true);
      }
    },

    undoColorSchemePreview() {
      this.setProperties({
        selectedColorSchemeId: this.session.userColorSchemeId,
        selectedDarkColorSchemeId: this.session.userDarkSchemeId,
        previewingColorScheme: false,
      });
      const darkStylesheet = document.querySelector("link#cs-preview-dark"),
        lightStylesheet = document.querySelector("link#cs-preview-light");
      if (darkStylesheet) {
        darkStylesheet.remove();
      }

      if (lightStylesheet) {
        lightStylesheet.remove();
      }
    },
  },
});
