import EmberObject from "@ember/object";
import I18n from "I18n";
import Mixin from "@ember/object/mixin";
import User from "discourse/models/user";
import discourseComputed from "discourse-common/utils/decorators";
import discourseDebounce from "discourse/lib/debounce";
import { isEmpty } from "@ember/utils";
import { setting } from "discourse/lib/computed";

export default Mixin.create({
  uniqueUsernameValidation: null,

  maxUsernameLength: setting("max_username_length"),

  minUsernameLength: setting("min_username_length"),

  fetchExistingUsername: discourseDebounce(function () {
    User.checkUsername(null, this.accountEmail).then((result) => {
      if (
        result.suggestion &&
        (isEmpty(this.accountUsername) ||
          this.accountUsername === this.get("authOptions.username"))
      ) {
        this.setProperties({
          accountUsername: result.suggestion,
          prefilledUsername: result.suggestion,
        });
      }
    });
  }, 500),

  @discourseComputed("accountUsername")
  basicUsernameValidation(accountUsername) {
    const failedAttrs = {
      failed: true,
      element: document.querySelector("#new-account-username"),
    };
    this.set("uniqueUsernameValidation", null);

    if (accountUsername && accountUsername === this.prefilledUsername) {
      return EmberObject.create({
        ok: true,
        reason: I18n.t("user.username.prefilled"),
      });
    }

    // If blank, fail without a reason
    if (isEmpty(accountUsername)) {
      return EmberObject.create(
        Object.assign(failedAttrs, {
          message: I18n.t("user.username.required"),
        })
      );
    }

    // If too short
    if (accountUsername.length < this.siteSettings.min_username_length) {
      return EmberObject.create(
        Object.assign(failedAttrs, {
          reason: I18n.t("user.username.too_short"),
        })
      );
    }

    // If too long
    if (accountUsername.length > this.maxUsernameLength) {
      return EmberObject.create(
        Object.assign(failedAttrs, {
          reason: I18n.t("user.username.too_long"),
        })
      );
    }

    this.checkUsernameAvailability();
    // Let's check it out asynchronously
    return EmberObject.create(
      Object.assign(failedAttrs, {
        reason: I18n.t("user.username.checking"),
      })
    );
  },

  shouldCheckUsernameAvailability() {
    return (
      !isEmpty(this.accountUsername) &&
      this.accountUsername.length >= this.minUsernameLength
    );
  },

  checkUsernameAvailability: discourseDebounce(function () {
    if (this.shouldCheckUsernameAvailability()) {
      return User.checkUsername(this.accountUsername, this.accountEmail).then(
        (result) => {
          this.set("isDeveloper", false);
          if (result.available) {
            if (result.is_developer) {
              this.set("isDeveloper", true);
            }
            return this.set(
              "uniqueUsernameValidation",
              EmberObject.create({
                ok: true,
                reason: I18n.t("user.username.available"),
              })
            );
          } else {
            const failedAttrs = {
              failed: true,
              element: document.querySelector("#new-account-username"),
            };

            if (result.suggestion) {
              return this.set(
                "uniqueUsernameValidation",
                EmberObject.create(
                  Object.assign(failedAttrs, {
                    reason: I18n.t("user.username.not_available", result),
                  })
                )
              );
            } else {
              return this.set(
                "uniqueUsernameValidation",
                EmberObject.create(
                  Object.assign(failedAttrs, {
                    reason: result.errors
                      ? result.errors.join(" ")
                      : I18n.t("user.username.not_available_no_suggestion"),
                  })
                )
              );
            }
          }
        }
      );
    }
  }, 500),

  // Actually wait for the async name check before we're 100% sure we're good to go
  @discourseComputed("uniqueUsernameValidation", "basicUsernameValidation")
  usernameValidation() {
    const basicValidation = this.basicUsernameValidation;
    const uniqueUsername = this.uniqueUsernameValidation;
    return uniqueUsername ? uniqueUsername : basicValidation;
  },
});
