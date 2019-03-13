import { iconHTML } from "discourse-common/lib/icon-library";
import { bufferedRender } from "discourse-common/lib/buffered-render";
import { escapeExpression } from "discourse/lib/utilities";
import TopicStatusIcons from "discourse/helpers/topic-status-icons";

export default Ember.Component.extend(
  bufferedRender({
    classNames: ["topic-statuses"],

    rerenderTriggers: [
      "topic.archived",
      "topic.closed",
      "topic.pinned",
      "topic.visible",
      "topic.unpinned",
      "topic.is_warning"
    ],

    click(e) {
      // only pin unpin for now
      if (this.get("canAct") && $(e.target).hasClass("d-icon-thumbtack")) {
        const topic = this.get("topic");
        topic.get("pinned") ? topic.clearPin() : topic.rePin();
      }

      return false;
    },

    canAct: function() {
      return Discourse.User.current() && !this.get("disableActions");
    }.property("disableActions"),

    buildBuffer(buffer) {
      const canAct = this.get("canAct");
      const topic = this.get("topic");

      if (!topic) {
        return;
      }

      TopicStatusIcons.render(topic, function(name, key) {
        const actionable = ["pinned", "unpinned"].includes(key) && canAct;
        const title = escapeExpression(I18n.t(`topic_statuses.${key}.help`)),
          startTag = actionable ? "a href" : "span",
          endTag = actionable ? "a" : "span",
          iconArgs = key === "unpinned" ? { class: "unpinned" } : null,
          icon = iconHTML(name, iconArgs);

        buffer.push(
          `<${startTag} title='${title}' class='topic-status'>${icon}</${endTag}>`
        );
      });
    }
  })
);
