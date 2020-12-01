import Component from "@ember/component";
import Group from "discourse/models/group";
import I18n from "I18n";
import PermissionType from "discourse/models/permission-type";
import bootbox from "bootbox";
import { bufferedProperty } from "discourse/mixins/buffered-content";
import discourseComputed from "discourse-common/utils/decorators";
import { isEmpty } from "@ember/utils";

export default Component.extend(bufferedProperty("model"), {
  tagName: "",
  allGroups: null,

  init() {
    this._super(...arguments);
    this.setGroupOptions();
  },

  setGroupOptions() {
    Group.findAll().then((groups) => {
      this.set("allGroups", groups);
    });
  },

  @discourseComputed(
    "buffered.isSaving",
    "buffered.name",
    "buffered.tag_names",
    "buffered.permissions"
  )
  savingDisabled(isSaving, name, tagNames, permissions) {
    return (
      isSaving ||
      isEmpty(name) ||
      isEmpty(tagNames) ||
      (!this.everyoneSelected(permissions) &&
        isEmpty(this.selectedGroupNames(permissions)))
    );
  },

  @discourseComputed("buffered.permissions")
  showPrivateChooser(permissions) {
    if (!permissions) {
      return true;
    }

    return permissions.everyone !== PermissionType.READONLY;
  },

  @discourseComputed("buffered.permissions", "allGroups")
  selectedGroupIds(permissions, allGroups) {
    if (!permissions || !allGroups) {
      return [];
    }

    const selectedGroupNames = Object.keys(permissions);
    let groupIds = [];
    allGroups.forEach((group) => {
      if (selectedGroupNames.includes(group.name)) {
        groupIds.push(group.id);
      }
    });

    return groupIds;
  },

  everyoneSelected(permissions) {
    if (!permissions) {
      return true;
    }

    return permissions.everyone === PermissionType.FULL;
  },

  selectedGroupNames(permissions) {
    if (!permissions) {
      return [];
    }

    return Object.keys(permissions).filter((name) => name !== "everyone");
  },

  actions: {
    setPermissionsType(permissionName) {
      let updatedPermissions = Object.assign(
        {},
        this.buffered.get("permissions")
      );

      if (permissionName === "private") {
        delete updatedPermissions.everyone;
      } else if (permissionName === "visible") {
        updatedPermissions.everyone = PermissionType.READONLY;
      } else {
        updatedPermissions.everyone = PermissionType.FULL;
      }

      this.buffered.set("permissions", updatedPermissions);
    },

    setPermissionsGroups(groupIds) {
      let updatedPermissions = Object.assign(
        {},
        this.buffered.get("permissions")
      );

      this.allGroups.forEach((group) => {
        if (groupIds.includes(group.id)) {
          updatedPermissions[group.name] = PermissionType.FULL;
        }
      });

      this.buffered.set("permissions", updatedPermissions);
    },

    save() {
      const attrs = this.buffered.getProperties(
        "name",
        "tag_names",
        "parent_tag_name",
        "one_per_topic",
        "permissions"
      );

      // If 'everyone' is set to full, we can remove any groups.
      if (
        !attrs.permissions ||
        attrs.permissions.everyone === PermissionType.FULL
      ) {
        attrs.permissions = { everyone: PermissionType.FULL };
      }

      this.model.save(attrs).then(() => {
        this.commitBuffer();

        if (this.onSave) {
          this.onSave();
        }
      });
    },

    destroy() {
      return bootbox.confirm(
        I18n.t("tagging.groups.confirm_delete"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        (destroy) => {
          if (!destroy) {
            return;
          }

          this.model.destroyRecord().then(() => {
            if (this.onDestroy) {
              this.onDestroy();
            }
          });
        }
      );
    },
  },
});
