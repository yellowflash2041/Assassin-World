import I18n from "I18n";

import BaseSectionLink from "discourse/lib/sidebar/base-community-section-link";

export default class BadgesSectionLink extends BaseSectionLink {
  get name() {
    return "badges";
  }

  get route() {
    return "badges";
  }

  get title() {
    return I18n.t("sidebar.sections.community.links.badges.content");
  }

  get text() {
    return I18n.t("sidebar.sections.community.links.badges.content");
  }
}
