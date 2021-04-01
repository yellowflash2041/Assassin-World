import RawHtml from "discourse/widgets/raw-html";
import { iconHTML } from "discourse-common/lib/icon-library";
import { h } from "virtual-dom";
import QuickAccessPanel from "discourse/widgets/quick-access-panel";
import { createWidget, createWidgetFrom } from "discourse/widgets/widget";
import { postUrl } from "discourse/lib/utilities";
import getURL from "discourse-common/lib/get-url";
import I18n from "I18n";

const ICON = "notification.private_message";

function toItem(message) {
  const lastReadPostNumber = message.last_read_post_number || 0;
  const nextUnreadPostNumber = Math.min(
    lastReadPostNumber + 1,
    message.highest_post_number
  );

  return {
    escapedContent: message.fancy_title,
    href: postUrl(message.slug, message.id, nextUnreadPostNumber),
    icon: ICON,
    read: message.last_read_post_number >= message.highest_post_number,
    username: message.last_poster_username,
  };
}

createWidget("no-quick-access-messages", {
  html() {
    let privacyLink =
      this.siteSettings.privacy_policy_url || getURL("/privacy");

    let rawHtml = [
      `<div class="empty-state-body">
      <p>
      ${I18n.t("user.no_messages_body", {
        privacyLink,
      }).htmlSafe()}</p>`,
    ];

    if (this.currentUser.can_send_private_messages) {
      rawHtml.push(
        `<p>
          <a class="btn btn-primary btn-icon-text" href="${getURL(
            ""
          )}/new-message">
            ${iconHTML("envelope")}${I18n.t(
          "user.new_private_message"
        ).htmlSafe()}
          </a>
        </p>`
      );
    }
    rawHtml.push("</div>");

    return h("div.empty-state", [
      h("span.empty-state-title", I18n.t("user.no_messages_title")),
      new RawHtml({
        html: rawHtml.join(""),
      }),
    ]);
  },
});

createWidgetFrom(QuickAccessPanel, "quick-access-messages", {
  buildKey: () => "quick-access-messages",
  emptyStateWidget: "no-quick-access-messages",

  showAllHref() {
    return `${this.attrs.path}/messages`;
  },

  findNewItems() {
    return this.store
      .findFiltered("topicList", {
        filter: `topics/private-messages/${this.currentUser.username_lower}`,
      })
      .then(({ topic_list }) => {
        return topic_list.topics.map(toItem);
      });
  },

  itemHtml(message) {
    return this.attach("quick-access-item", message);
  },
});
