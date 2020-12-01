import Component from "@ember/component";
import FilterModeMixin from "discourse/mixins/filter-mode";
import NavItem from "discourse/models/nav-item";
import bootbox from "bootbox";
import discourseComputed from "discourse-common/utils/decorators";
import { inject as service } from "@ember/service";

export default Component.extend(FilterModeMixin, {
  router: service(),

  tagName: "",

  // Should be a `readOnly` instead but some themes/plugins still pass
  // the `categories` property into this component
  @discourseComputed("site.categoriesList")
  categories(categoriesList) {
    return categoriesList;
  },

  @discourseComputed("category")
  showCategoryNotifications(category) {
    return category && this.currentUser;
  },

  @discourseComputed("category", "createTopicDisabled")
  categoryReadOnlyBanner(category, createTopicDisabled) {
    if (category && this.currentUser && createTopicDisabled) {
      return category.read_only_banner;
    }
  },

  @discourseComputed(
    "createTopicDisabled",
    "hasDraft",
    "categoryReadOnlyBanner",
    "canCreateTopicOnTag",
    "tag.id"
  )
  createTopicButtonDisabled(
    createTopicDisabled,
    hasDraft,
    categoryReadOnlyBanner,
    canCreateTopicOnTag,
    tagId
  ) {
    if (tagId && !canCreateTopicOnTag) {
      return true;
    } else if (categoryReadOnlyBanner && !hasDraft) {
      return false;
    }
    return createTopicDisabled;
  },

  @discourseComputed("categoryReadOnlyBanner", "hasDraft")
  createTopicClass(categoryReadOnlyBanner, hasDraft) {
    if (categoryReadOnlyBanner && !hasDraft) {
      return "btn-default disabled";
    } else {
      return "btn-default";
    }
  },

  @discourseComputed("hasDraft")
  createTopicLabel(hasDraft) {
    return hasDraft ? "topic.open_draft" : "topic.create";
  },

  @discourseComputed("category.can_edit")
  showCategoryEdit: (canEdit) => canEdit,

  @discourseComputed("additionalTags", "category", "tag.id")
  showToggleInfo(additionalTags, category, tagId) {
    return !additionalTags && !category && tagId !== "none";
  },

  @discourseComputed("filterType", "category", "noSubcategories", "tag.id")
  navItems(filterType, category, noSubcategories, tagId) {
    const currentRouteQueryParams = this.get("router.currentRoute.queryParams");

    return NavItem.buildList(category, {
      filterType,
      noSubcategories,
      currentRouteQueryParams,
      tagId,
      siteSettings: this.siteSettings,
    });
  },

  actions: {
    changeCategoryNotificationLevel(notificationLevel) {
      this.category.setNotification(notificationLevel);
    },

    selectCategoryAdminDropdownAction(actionId) {
      switch (actionId) {
        case "create":
          this.createCategory();
          break;
        case "reorder":
          this.reorderCategories();
          break;
      }
    },

    clickCreateTopicButton() {
      if (this.categoryReadOnlyBanner && !this.hasDraft) {
        bootbox.alert(this.categoryReadOnlyBanner);
      } else {
        this.createTopic();
      }
    },
  },
});
