import SelectBoxComponent from "discourse/components/select-box";
import { categoryBadgeHTML } from "discourse/helpers/category-link";
import { observes, on } from "ember-addons/ember-computed-decorators";
import PermissionType from "discourse/models/permission-type";
import Category from "discourse/models/category";

export default SelectBoxComponent.extend({
  classNames: ["category-select-box"],

  selectBoxRowComponent: "category-select-box/category-select-box-row",

  textKey: "name",

  filterable: true,

  castInteger: true,

  clearable: true,

  allowUncategorized: null,

  init() {
    this._super();

    if (!Ember.isNone(this.get("categories"))) {
      this.set("content", this.get("categories"));
      this._scopeCategories();
    }

    if (Ember.isNone(this.get("value"))) {
      if (this.siteSettings.allow_uncategorized_topics && this.get("allowUncategorized") !== false) {
        this.set("value", Category.findUncategorized().id);
      }
    }
  },

  filterFunction: function(content) {
    const _matchFunction = (filter, text) => {
      return text.toLowerCase().indexOf(filter) > -1;
    };

    return (selectBox) => {
      const filter = selectBox.get("filter").toLowerCase();
      return _.filter(content, (c) => {
        const category = Category.findById(c[selectBox.get("idKey")]);
        const text = c[selectBox.get("textKey")];
        if (category && category.get("parentCategory")) {
          const categoryName = category.get("parentCategory.name");
          return _matchFunction(filter, text) || _matchFunction(filter, categoryName);
        } else {
          return _matchFunction(filter, text);
        }
      });
    };
  },

  @on("init")
  @observes("selectedContent")
  _setHeaderText: function() {
    let headerText;

    if (Ember.isNone(this.get("selectedContent"))) {
      if (this.siteSettings.allow_uncategorized_topics) {
        headerText = Ember.get(Category.findUncategorized(), this.get("textKey"));
      } else {
        headerText = I18n.t("category.choose").htmlSafe();
      }
    } else {
      headerText = this.get("selectedContent.text");
    }

    this.set("headerText", headerText);
  },

  templateForRow: function() {
    return (rowComponent) => this.rowContentTemplate(rowComponent.get("content"));
  }.property(),

  @observes("scopedCategoryId", "categories")
  _scopeCategories() {
    let scopedCategoryId = this.get("scopedCategoryId");
    const categories = this.get("categories");

    // Always scope to the parent of a category, if present
    if (scopedCategoryId) {
      const scopedCat = Category.findById(scopedCategoryId);
      scopedCategoryId = scopedCat.get("parent_category_id") || scopedCat.get("id");
    }

    const excludeCategoryId = this.get("excludeCategoryId");

    const filteredCategories = categories.filter(c => {
      const categoryId = c.get("id");
      if (scopedCategoryId && categoryId !== scopedCategoryId && c.get("parent_category_id") !== scopedCategoryId) { return false; }
      if (excludeCategoryId === categoryId) { return false; }
      if (this.get("allowUncategorized") === false && c.get("isUncategorizedCategory")) { return false; }
      if (this.get("allowUncategorized") !== true) {
        if (!this.siteSettings.allow_uncategorized_topics && c.get("isUncategorizedCategory")) {
          return false;
        }
      }
      return c.get("permission") === PermissionType.FULL;
    });

    this.set("content", filteredCategories);
  },

  @on("didRender")
  _bindComposerResizing() {
    this.appEvents.on("composer:resized", this, this.applyDirection);
  },

  @on("willDestroyElement")
  _unbindComposerResizing() {
    this.appEvents.off("composer:resized");
  },

  @on("init")
  @observes("site.sortedCategories")
  _updateCategories() {
    if (!this.get("categories")) {
      const categories = Discourse.SiteSettings.fixed_category_positions_on_create ?
                        Category.list() :
                        Category.listByActivity();
      this.set("categories", categories);
    }
  },

  rowContentTemplate(item) {
    let category;

    // If we have no id, but text with the uncategorized name, we can use that badge.
    if (Ember.isEmpty(item.id)) {
      const uncat = Category.findUncategorized();
      if (uncat && uncat.get("name") === item.text) {
        category = uncat;
      }
    } else {
      category = Category.findById(parseInt(item.id,10));
    }

    if (!category) return item.text;
    let result = categoryBadgeHTML(category, {link: false, allowUncategorized: true, hideParent: true});
    const parentCategoryId = category.get("parent_category_id");

    if (parentCategoryId) {
      result = `<div class="category-status">${categoryBadgeHTML(Category.findById(parentCategoryId), {link: false})}&nbsp;${result}`;
    } else {
      result = `<div class="category-status">${result}`;
    }

    result += ` <span class="topic-count">&times; ${category.get("topic_count")}</span></div>`;

    const description = category.get("description");
    // TODO wtf how can this be null?;
    if (description && description !== "null") {
      result += `<div class="category-desc">${description.substr(0, 200)}${description.length > 200 ? '&hellip;' : ''}</div>`;
    }

    return result;
  }
});
