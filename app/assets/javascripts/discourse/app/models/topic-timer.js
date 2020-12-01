import RestModel from "discourse/models/rest";
import { ajax } from "discourse/lib/ajax";

const TopicTimer = RestModel.extend({});

TopicTimer.reopenClass({
  updateStatus(
    topicId,
    time,
    basedOnLastPost,
    statusType,
    categoryId,
    duration
  ) {
    let data = {
      time,
      status_type: statusType,
    };

    if (basedOnLastPost) {
      data.based_on_last_post = basedOnLastPost;
    }
    if (categoryId) {
      data.category_id = categoryId;
    }
    if (duration) {
      data.duration = duration;
    }

    return ajax({
      url: `/t/${topicId}/timer`,
      type: "POST",
      data,
    });
  },
});

export default TopicTimer;
