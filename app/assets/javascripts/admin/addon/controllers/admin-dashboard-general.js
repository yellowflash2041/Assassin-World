import I18n from "I18n";
import discourseComputed from "discourse-common/utils/decorators";
import { makeArray } from "discourse-common/lib/helpers";
import Controller, { inject } from "@ember/controller";
import { setting } from "discourse/lib/computed";
import AdminDashboard from "admin/models/admin-dashboard";
import Report from "admin/models/report";
import PeriodComputationMixin from "admin/mixins/period-computation";
import { computed } from "@ember/object";
import getURL from "discourse-common/lib/get-url";

function staticReport(reportType) {
  return computed("reports.[]", function () {
    return makeArray(this.reports).find((report) => report.type === reportType);
  });
}

export default Controller.extend(PeriodComputationMixin, {
  isLoading: false,
  dashboardFetchedAt: null,
  exceptionController: inject("exception"),
  logSearchQueriesEnabled: setting("log_search_queries"),

  @discourseComputed("siteSettings.dashboard_general_tab_activity_metrics")
  activityMetrics(metrics) {
    return (metrics || "").split("|").filter(Boolean);
  },

  hiddenReports: computed("siteSettings.dashboard_hidden_reports", function () {
    return (this.siteSettings.dashboard_hidden_reports || "")
      .split("|")
      .filter(Boolean);
  }),

  isActivityMetricsVisible: computed(
    "activityMetrics",
    "hiddenReports",
    function () {
      return (
        this.activityMetrics.length &&
        this.activityMetrics.some((x) => !this.hiddenReports.includes(x))
      );
    }
  ),

  isSearchReportsVisible: computed("hiddenReports", function () {
    return ["top_referred_topics", "trending_search"].some(
      (x) => !this.hiddenReports.includes(x)
    );
  }),

  isCommunityHealthVisible: computed("hiddenReports", function () {
    return [
      "consolidated_page_views",
      "signups",
      "topics",
      "posts",
      "dau_by_mau",
      "daily_engaged_users",
      "new_contributors",
    ].some((x) => !this.hiddenReports.includes(x));
  }),

  @discourseComputed
  activityMetricsFilters() {
    return {
      startDate: this.lastMonth,
      endDate: this.today,
    };
  },

  @discourseComputed
  topReferredTopicsOptions() {
    return {
      table: { total: false, limit: 8 },
    };
  },

  @discourseComputed
  topReferredTopicsFilters() {
    return {
      startDate: moment().subtract(6, "days").startOf("day"),
      endDate: this.today,
    };
  },

  @discourseComputed
  trendingSearchFilters() {
    return {
      startDate: moment().subtract(1, "month").startOf("day"),
      endDate: this.today,
    };
  },

  @discourseComputed
  trendingSearchOptions() {
    return {
      table: { total: false, limit: 8 },
    };
  },

  @discourseComputed
  trendingSearchDisabledLabel() {
    return I18n.t("admin.dashboard.reports.trending_search.disabled", {
      basePath: getURL(""),
    });
  },

  usersByTypeReport: staticReport("users_by_type"),
  usersByTrustLevelReport: staticReport("users_by_trust_level"),
  storageReport: staticReport("storage_report"),

  fetchDashboard() {
    if (this.isLoading) {
      return;
    }

    if (
      !this.dashboardFetchedAt ||
      moment().subtract(30, "minutes").toDate() > this.dashboardFetchedAt
    ) {
      this.set("isLoading", true);

      AdminDashboard.fetchGeneral()
        .then((adminDashboardModel) => {
          this.setProperties({
            dashboardFetchedAt: new Date(),
            model: adminDashboardModel,
            reports: makeArray(adminDashboardModel.reports).map((x) =>
              Report.create(x)
            ),
          });
        })
        .catch((e) => {
          this.exceptionController.set("thrown", e.jqXHR);
          this.replaceRoute("exception");
        })
        .finally(() => this.set("isLoading", false));
    }
  },

  @discourseComputed("startDate", "endDate")
  filters(startDate, endDate) {
    return { startDate, endDate };
  },

  _reportsForPeriodURL(period) {
    return getURL(`/admin?period=${period}`);
  },
});
