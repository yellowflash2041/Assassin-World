/**
  The parent route for all discovery routes.
  Handles the logic for showing the loading spinners.
**/
import DiscourseRoute from "discourse/routes/discourse";
import OpenComposer from "discourse/mixins/open-composer";
import User from "discourse/models/user";
import { scrollTop } from "discourse/mixins/scroll-top";
import { setTopicList } from "discourse/lib/topic-list-tracker";

export default DiscourseRoute.extend(OpenComposer, {
  queryParams: {
    filter: { refreshModel: true },
  },

  redirect() {
    return this.redirectIfLoginRequired();
  },

  beforeModel(transition) {
    const url = transition.intent.url;
    if (
      (url === "/" || url === "/latest" || url === "/categories") &&
      transition.targetName.indexOf("discovery.top") === -1 &&
      User.currentProp("should_be_redirected_to_top")
    ) {
      User.currentProp("should_be_redirected_to_top", false);
      const period = User.currentProp("redirected_to_top.period") || "all";
      this.replaceWith(`discovery.top${period.capitalize()}`);
    }
  },

  actions: {
    loading() {
      this.controllerFor("discovery").set("loading", true);
      return true;
    },

    loadingComplete() {
      this.controllerFor("discovery").set("loading", false);
      if (!this.session.get("topicListScrollPosition")) {
        scrollTop();
      }
      return false;
    },

    didTransition() {
      this.controllerFor("discovery")._showFooter();
      this.send("loadingComplete");

      const model = this.controllerFor("discovery/topics").get("model");
      setTopicList(model);
      return false;
    },

    // clear a pinned topic
    clearPin(topic) {
      topic.clearPin();
    },

    createTopic() {
      const model = this.controllerFor("discovery/topics").get("model");
      if (model.draft) {
        this.openTopicDraft(model);
      } else {
        this.openComposer(this.controllerFor("discovery/topics"));
      }
    },

    dismissReadTopics(dismissTopics) {
      const operationType = dismissTopics ? "topics" : "posts";
      this.send("dismissRead", operationType);
    },

    dismissRead(operationType) {
      const controller = this.controllerFor("discovery/topics");
      controller.send("dismissRead", operationType, {
        categoryId: controller.get("category.id"),
        includeSubcategories: !controller.noSubcategories,
      });
    },
  },
});
