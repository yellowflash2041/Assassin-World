import DiscourseRoute from "discourse/routes/discourse";

export default DiscourseRoute.extend({
  redirect() {
    this.transitionTo("adminLogs.staffActionLogs");
  },
});
