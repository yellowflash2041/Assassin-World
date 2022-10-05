import AdminEmailLogsController from "admin/controllers/admin-email-logs";
import { INPUT_DELAY } from "discourse-common/config/environment";
import discourseDebounce from "discourse-common/lib/debounce";
import { observes } from "discourse-common/utils/decorators";
import { action } from "@ember/object";

export default AdminEmailLogsController.extend({
  @action
  handleShowIncomingEmail(id, event) {
    event?.preventDefault();
    this.send("showIncomingEmail", id);
  },

  @observes("filter.{status,user,address,type}")
  filterEmailLogs() {
    discourseDebounce(this, this.loadLogs, INPUT_DELAY);
  },
});
