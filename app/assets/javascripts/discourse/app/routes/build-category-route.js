import { Promise, all } from "rsvp";
import {
  changeSort,
  queryParams,
  resetParams,
} from "discourse/controllers/discovery-sortable";
import {
  filterQueryParams,
  findTopicList,
} from "discourse/routes/build-topic-route";
import Category from "discourse/models/category";
import CategoryList from "discourse/models/category-list";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import PermissionType from "discourse/models/permission-type";
import TopicList from "discourse/models/topic-list";

// A helper function to create a category route with parameters
export default (filterArg, params) => {
  return DiscourseRoute.extend({
    queryParams,

    serialize(modelParams) {
      if (!modelParams.category_slug_path_with_id) {
        if (modelParams.id === "none") {
          const category_slug_path_with_id = [
            modelParams.parentSlug,
            modelParams.slug,
          ].join("/");
          const category = Category.findBySlugPathWithID(
            category_slug_path_with_id
          );
          this.replaceWith("discovery.categoryNone", {
            category,
            category_slug_path_with_id,
          });
        } else if (modelParams.id === "all") {
          modelParams.category_slug_path_with_id = [
            modelParams.parentSlug,
            modelParams.slug,
          ].join("/");
        } else {
          modelParams.category_slug_path_with_id = [
            modelParams.parentSlug,
            modelParams.slug,
            modelParams.id,
          ]
            .filter((x) => x)
            .join("/");
        }
      }

      return modelParams;
    },

    model(modelParams) {
      modelParams = this.serialize(modelParams);

      const category = Category.findBySlugPathWithID(
        modelParams.category_slug_path_with_id
      );

      if (!category) {
        const parts = modelParams.category_slug_path_with_id.split("/");
        if (parts.length > 0 && parts[parts.length - 1].match(/^\d+$/)) {
          parts.pop();
        }

        return Category.reloadBySlugPath(parts.join("/")).then((result) => {
          const record = this.store.createRecord("category", result.category);
          record.setupGroupsAndPermissions();
          this.site.updateCategory(record);
          return { category: record, modelParams };
        });
      }

      if (category) {
        return { category, modelParams };
      }
    },

    afterModel(model, transition) {
      if (!model) {
        this.replaceWith("/404");
        return;
      }

      const { category, modelParams } = model;

      if (
        category.default_list_filter === "none" &&
        filterArg === "default" &&
        modelParams &&
        modelParams.id !== "all"
      ) {
        this.replaceWith("discovery.categoryNone", {
          category,
          category_slug_path_with_id: modelParams.category_slug_path_with_id,
        });
      }

      this._setupNavigation(category);
      return all([
        this._createSubcategoryList(category),
        this._retrieveTopicList(category, transition, modelParams),
      ]);
    },

    filter(category) {
      return filterArg === "default"
        ? category.get("default_view") || "latest"
        : filterArg;
    },

    _setupNavigation(category) {
      const noSubcategories = params && !!params.no_subcategories,
        filterType = this.filter(category).split("/")[0];

      this.controllerFor("navigation/category").setProperties({
        category,
        filterType,
        noSubcategories,
      });
    },

    _createSubcategoryList(category) {
      this._categoryList = null;

      if (category.isParent && category.show_subcategory_list) {
        return CategoryList.listForParent(this.store, category).then(
          (list) => (this._categoryList = list)
        );
      }

      // If we're not loading a subcategory list just resolve
      return Promise.resolve();
    },

    _retrieveTopicList(category, transition, modelParams) {
      const listFilter = `c/${Category.slugFor(category)}/${
          category.id
        }/l/${this.filter(category)}`,
        findOpts = filterQueryParams(modelParams, params),
        extras = { cached: this.isPoppedState(transition) };

      return findTopicList(
        this.store,
        this.topicTrackingState,
        listFilter,
        findOpts,
        extras
      ).then((list) => {
        TopicList.hideUniformCategory(list, category);
        this.set("topics", list);
        return list;
      });
    },

    titleToken() {
      const category = this.currentModel.category;

      const filterText = I18n.t(
        "filters." + this.filter(category).replace("/", ".") + ".title"
      );

      let categoryName = category.name;
      if (category.parent_category_id) {
        const list = Category.list();
        const parentCategory = list.findBy("id", category.parent_category_id);
        categoryName = `${parentCategory.name}/${categoryName}`;
      }

      return I18n.t("filters.with_category", {
        filter: filterText,
        category: categoryName,
      });
    },

    setupController(controller, model) {
      const topics = this.topics,
        category = model.category,
        canCreateTopic = topics.get("can_create_topic"),
        canCreateTopicOnCategory =
          canCreateTopic && category.get("permission") === PermissionType.FULL,
        filter = this.filter(category);

      this.controllerFor("navigation/category").setProperties({
        canCreateTopicOnCategory: canCreateTopicOnCategory,
        cannotCreateTopicOnCategory: !canCreateTopicOnCategory,
        canCreateTopic: canCreateTopic,
      });

      var topicOpts = {
        model: topics,
        category,
        period:
          topics.get("for_period") ||
          (filter.indexOf("/") > 0 ? filter.split("/")[1] : ""),
        selected: [],
        noSubcategories: params && !!params.no_subcategories,
        expandAllPinned: true,
        canCreateTopic: canCreateTopic,
        canCreateTopicOnCategory: canCreateTopicOnCategory,
      };

      const p = category.get("params");
      if (p && Object.keys(p).length) {
        if (p.order !== undefined) {
          topicOpts.order = p.order;
        }
        if (p.ascending !== undefined) {
          topicOpts.ascending = p.ascending;
        }
      }

      this.controllerFor("discovery/topics").setProperties(topicOpts);
      this.searchService.set("searchContext", category.get("searchContext"));
      this.set("topics", null);
    },

    renderTemplate() {
      this.render("navigation/category", { outlet: "navigation-bar" });

      if (this._categoryList) {
        this.render("discovery/categories", {
          outlet: "header-list-container",
          model: this._categoryList,
        });
      }
      this.render("discovery/topics", {
        controller: "discovery/topics",
        outlet: "list-container",
      });
    },

    deactivate() {
      this._super(...arguments);
      this.searchService.set("searchContext", null);
    },

    actions: {
      error(err) {
        const json = err.jqXHR.responseJSON;
        if (json && json.extras && json.extras.html) {
          this.controllerFor("discovery").set(
            "errorHtml",
            err.jqXHR.responseJSON.extras.html
          );
        } else {
          this.replaceWith("exception");
        }
      },

      setNotification(notification_level) {
        this.currentModel.setNotification(notification_level);
      },

      triggerRefresh() {
        this.refresh();
      },

      changeSort,
      resetParams,
    },
  });
};
