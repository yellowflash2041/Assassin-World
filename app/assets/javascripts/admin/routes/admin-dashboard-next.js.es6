export default Discourse.Route.extend({
  activate() {
    this.controllerFor('admin-dashboard-next').fetchDashboard();
  }
});
