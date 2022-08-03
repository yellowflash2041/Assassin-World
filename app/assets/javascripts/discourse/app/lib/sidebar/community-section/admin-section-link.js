import I18n from "I18n";

import BaseSectionLink from "discourse/lib/sidebar/community-section/base-section-link";

export default class AdminSectionLink extends BaseSectionLink {
  get name() {
    return "admin";
  }

  get route() {
    return "admin";
  }

  get title() {
    return I18n.t("admin_title");
  }

  get text() {
    return I18n.t("admin_title");
  }
}
