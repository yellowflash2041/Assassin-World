import ReviewableItemBase from "discourse/lib/reviewable-items/base";
import { htmlSafe } from "@ember/template";
import I18n from "I18n";

export default class extends ReviewableItemBase {
  get description() {
    const title = this.reviewable.topic_fancy_title;
    const postNumber = this.reviewable.post_number;
    if (title && postNumber) {
      return htmlSafe(
        I18n.t("user_menu.reviewable.post_number_with_topic_title", {
          post_number: postNumber,
          title,
        })
      );
    } else {
      return I18n.t("user_menu.reviewable.delete_post");
    }
  }
}
