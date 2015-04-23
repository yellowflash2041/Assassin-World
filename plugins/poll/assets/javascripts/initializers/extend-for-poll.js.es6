import PostView from "discourse/views/post";

function createPollView(container, post, poll, vote) {
  const controller = container.lookup("controller:poll", { singleton: false }),
        view = container.lookup("view:poll");

  controller.set("vote", vote);

  controller.setProperties({
    model: Em.Object.create(poll),
    post: post,
  });

  view.set("controller", controller);

  return view;
}

export default {
  name: "extend-for-poll",

  initialize(container) {

    // overwrite polls
    PostView.reopen({
      _createPollViews: function($post) {
        const self = this,
              post = this.get("post"),
              polls = post.get("polls"),
              votes = post.get("polls_votes") || {};

        // don't even bother when there's no poll
        if (!polls) { return; }

        const pollViews = {};

        // iterate over all polls
        $(".poll", $post).each(function() {
          const $div = $("<div>"),
                $poll = $(this),
                pollName = $poll.data("poll-name"),
                pollView = createPollView(container, post, polls[pollName], votes[pollName]);

          $poll.replaceWith($div);
          pollView.constructor.renderer.replaceIn(pollView, $div[0]);
          pollViews[pollName] = pollView;
        });

        this.messageBus.subscribe("/polls/" + this.get("post.id"), results => {
          pollViews[results.poll.name].get("controller").set("model", Em.Object.create(results.poll));
        });

        this.set("pollViews", pollViews);
      }.on("postViewInserted"),

      _cleanUpPollViews: function() {
        this.messageBus.unsubscribe("/polls/*");

        if (this.get("pollViews")) {
          _.forEach(this.get("pollViews"), v => v.destroy());
        }
      }.on("willClearRender")
    });
  }
}
