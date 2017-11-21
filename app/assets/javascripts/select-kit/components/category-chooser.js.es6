import ComboBoxComponent from "select-kit/components/combo-box";
import { on } from "ember-addons/ember-computed-decorators";
import computed from "ember-addons/ember-computed-decorators";
import PermissionType from "discourse/models/permission-type";
import Category from "discourse/models/category";
const { get, isNone, isEmpty } = Ember;

export default ComboBoxComponent.extend({
  pluginApiIdentifiers: ["category-chooser"],
  classNames: "category-chooser",
  filterable: true,
  castInteger: true,
  allowUncategorized: false,
  rowComponent: "category-row",
  noneRowComponent: "none-category-row",
  allowSubCategories: true,

  filterComputedContent(computedContent, computedValue, filter) {
    if (isEmpty(filter)) { return computedContent; }

    const _matchFunction = (f, text) => {
      return text.toLowerCase().indexOf(f) > -1;
    };
    const lowerFilter = filter.toLowerCase();

    return computedContent.filter(c => {
      const category = Category.findById(get(c, "value"));
      const text = get(c, "name");
      if (category && category.get("parentCategory")) {
        const categoryName = category.get("parentCategory.name");
        return _matchFunction(lowerFilter, text) || _matchFunction(lowerFilter, categoryName);
      } else {
        return _matchFunction(lowerFilter, text);
      }
    });
  },

  @computed("rootNone", "rootNoneLabel")
  none(rootNone, rootNoneLabel) {
    if (this.siteSettings.allow_uncategorized_topics || this.get("allowUncategorized")) {
      if (!isNone(rootNone)) {
        return rootNoneLabel || "category.none";
      } else {
        return Category.findUncategorized();
      }
    } else {
      return "category.choose";
    }
  },

  @on("didRender")
  _bindComposerResizing() {
    this.appEvents.on("composer:resized", this, this.applyDirection);
  },

  @on("willDestroyElement")
  _unbindComposerResizing() {
    this.appEvents.off("composer:resized");
  },

  computeContent() {
    const categories = Discourse.SiteSettings.fixed_category_positions_on_create ?
      Category.list() :
      Category.listByActivity();

    let scopedCategoryId = this.get("scopedCategoryId");
    if (scopedCategoryId) {
      const scopedCat = Category.findById(scopedCategoryId);
      scopedCategoryId = scopedCat.get("parent_category_id") || scopedCat.get("id");
    }

    const excludeCategoryId = this.get("excludeCategoryId");

    return categories.filter(c => {
      const categoryId = this.valueForContentItem(c);

      if (scopedCategoryId && categoryId !== scopedCategoryId && get(c, "parent_category_id") !== scopedCategoryId) {
        return false;
      }

      if (this.get("allowSubCategories") === false && c.get("parentCategory") ) {
        return false;
      }

      if ((this.get("allowUncategorized") === false && get(c, "isUncategorizedCategory")) || excludeCategoryId === categoryId) {
        return false;
      }

      return get(c, "permission") === PermissionType.FULL;
    });
  }
});
