import { ajax } from "discourse/lib/ajax";

const GENERAL_ATTRIBUTES = ["updated_at"];

const AdminDashboard = Discourse.Model.extend({});

AdminDashboard.reopenClass({
  fetch() {
    return ajax("/admin/dashboard.json").then(json => {
      const model = AdminDashboard.create();
      model.set("version_check", json.version_check);
      return model;
    });
  },

  fetchGeneral() {
    return ajax("/admin/dashboard/general.json").then(json => {
      const model = AdminDashboard.create();

      const attributes = {};
      GENERAL_ATTRIBUTES.forEach(a => (attributes[a] = json[a]));

      model.setProperties({
        reports: json.reports,
        attributes,
        loaded: true
      });

      return model;
    });
  },

  fetchProblems() {
    return ajax("/admin/dashboard/problems.json").then(json => {
      const model = AdminDashboard.create(json);
      model.set("loaded", true);
      return model;
    });
  }
});

export default AdminDashboard;
