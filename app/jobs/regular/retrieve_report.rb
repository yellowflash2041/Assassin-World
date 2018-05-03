require_dependency 'report'

module Jobs
  class RetrieveReport < Jobs::Base
    sidekiq_options retry: false

    def execute(args)
      raise Discourse::InvalidParameters.new(:report_type) if !args["report_type"]

      type = args.delete("report_type")
      report = Report.new(type)
      report.start_date = args["start_date"].to_date if args["start_date"]
      report.end_date = args["end_date"].to_date if args["end_date"]
      report.category_id = args["category_id"] if args["category_id"]
      report.group_id = args["group_id"] if args["group_id"]

      Report.send("report_#{type}", report)

      Discourse.cache.write(Report.cache_key(report), report.as_json, force: true, expires_in: 30.minutes)

      MessageBus.publish("/admin/reports/#{type}", report.as_json, user_ids: User.staff.pluck(:id))
    end
  end
end
