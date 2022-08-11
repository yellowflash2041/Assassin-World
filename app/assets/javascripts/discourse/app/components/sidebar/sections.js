import Component from "@glimmer/component";
import { customSections as sidebarCustomSections } from "discourse/lib/sidebar/custom-sections";
import { getOwner, setOwner } from "@ember/application";
import { inject as service } from "@ember/service";

export default class SidebarSections extends Component {
  @service siteSettings;
  @service currentUser;

  customSections;

  constructor() {
    super(...arguments);
    this.customSections = this._customSections;
  }

  get _customSections() {
    return sidebarCustomSections.map((customSection) => {
      const section = new customSection({ sidebar: this });
      setOwner(section, getOwner(this));
      return section;
    });
  }
}
