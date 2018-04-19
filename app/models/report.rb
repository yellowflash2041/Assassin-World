require_dependency 'topic_subtype'

class Report

  attr_accessor :type, :data, :total, :prev30Days, :start_date, :end_date, :category_id, :group_id, :labels

  def self.default_days
    30
  end

  def initialize(type)
    @type = type
    @start_date ||= Report.default_days.days.ago.beginning_of_day
    @end_date ||= Time.zone.now.end_of_day
  end

  def as_json(options = nil)
    {
     type: type,
     title: I18n.t("reports.#{type}.title"),
     xaxis: I18n.t("reports.#{type}.xaxis"),
     yaxis: I18n.t("reports.#{type}.yaxis"),
     data: data,
     total: total,
     start_date: start_date,
     end_date: end_date,
     category_id: category_id,
     group_id: group_id,
     prev30Days: self.prev30Days,
     labels: labels
    }.tap do |json|
      if type == 'page_view_crawler_reqs'
        json[:related_report] = Report.find('web_crawlers', start_date: start_date, end_date: end_date)&.as_json
      end
    end
  end

  def Report.add_report(name, &block)
    singleton_class.instance_eval { define_method("report_#{name}", &block) }
  end

  def self.find(type, opts = nil)
    opts ||= {}

    # Load the report
    report = Report.new(type)
    report.start_date = opts[:start_date] if opts[:start_date]
    report.end_date = opts[:end_date] if opts[:end_date]
    report.category_id = opts[:category_id] if opts[:category_id]
    report.group_id = opts[:group_id] if opts[:group_id]
    report_method = :"report_#{type}"

    if respond_to?(report_method)
      send(report_method, report)
    elsif type =~ /_reqs$/
      req_report(report, type.split(/_reqs$/)[0].to_sym)
    else
      return nil
    end

    report
  end

  def self.req_report(report, filter = nil)
    data =
      if filter == :page_view_total
        ApplicationRequest.where(req_type: [
          ApplicationRequest.req_types.reject { |k, v| k =~ /mobile/ }.map { |k, v| v if k =~ /page_view/ }.compact
        ].flatten)
      else
        ApplicationRequest.where(req_type:  ApplicationRequest.req_types[filter])
      end

    report.data = []
    data.where('date >= ? AND date <= ?', report.start_date.to_date, report.end_date.to_date)
      .order(date: :asc)
      .group(:date)
      .sum(:count)
      .each do |date, count|
      report.data << { x: date, y: count }
    end

    report.total = data.sum(:count)

    report.prev30Days = data.where(
        'date >= ? AND date < ?',
        (report.start_date - 31.days).to_date, report.start_date.to_date
      ).sum(:count)
  end

  def self.report_visits(report)
    basic_report_about report, UserVisit, :by_day, report.start_date, report.end_date, report.group_id

    add_counts report, UserVisit, 'visited_at'
  end

  def self.report_mobile_visits(report)
    basic_report_about report, UserVisit, :mobile_by_day, report.start_date, report.end_date
    report.total      = UserVisit.where(mobile: true).count
    report.prev30Days = UserVisit.where(mobile: true).where("visited_at >= ? and visited_at < ?", report.start_date - 30.days, report.start_date).count
  end

  def self.report_signups(report)
    if report.group_id
      basic_report_about report, User.real, :count_by_signup_date, report.start_date, report.end_date, report.group_id
      add_counts report, User.real, 'users.created_at'
    else
      report_about report, User.real, :count_by_signup_date
    end
  end

  def self.report_profile_views(report)
    start_date = report.start_date.to_date
    end_date = report.end_date.to_date
    basic_report_about report, UserProfileView, :profile_views_by_day, start_date, end_date, report.group_id

    report.total = UserProfile.sum(:views)
    report.prev30Days = UserProfileView.where("viewed_at >= ? AND viewed_at < ?", start_date - 30.days, start_date + 1).count
  end

  def self.report_topics(report)
    basic_report_about report, Topic, :listable_count_per_day, report.start_date, report.end_date, report.category_id
    countable = Topic.listable_topics
    countable = countable.where(category_id: report.category_id) if report.category_id
    add_counts report, countable, 'topics.created_at'
  end

  def self.report_posts(report)
    basic_report_about report, Post, :public_posts_count_per_day, report.start_date, report.end_date, report.category_id
    countable = Post.public_posts.where(post_type: Post.types[:regular])
    countable = countable.joins(:topic).where("topics.category_id = ?", report.category_id) if report.category_id
    add_counts report, countable, 'posts.created_at'
  end

  def self.report_time_to_first_response(report)
    report.data = []
    Topic.time_to_first_response_per_day(report.start_date, report.end_date, category_id: report.category_id).each do |r|
      report.data << { x: Date.parse(r["date"]), y: r["hours"].to_f.round(2) }
    end
    report.total = Topic.time_to_first_response_total(category_id: report.category_id)
    report.prev30Days = Topic.time_to_first_response_total(start_date: report.start_date - 30.days, end_date: report.start_date, category_id: report.category_id)
  end

  def self.report_topics_with_no_response(report)
    report.data = []
    Topic.with_no_response_per_day(report.start_date, report.end_date, report.category_id).each do |r|
      report.data << { x: Date.parse(r["date"]), y: r["count"].to_i }
    end
    report.total = Topic.with_no_response_total(category_id: report.category_id)
    report.prev30Days = Topic.with_no_response_total(start_date: report.start_date - 30.days, end_date: report.start_date, category_id: report.category_id)
  end

  def self.report_emails(report)
    report_about report, EmailLog
  end

  def self.report_about(report, subject_class, report_method = :count_per_day)
    basic_report_about report, subject_class, report_method, report.start_date, report.end_date
    add_counts report, subject_class
  end

  def self.basic_report_about(report, subject_class, report_method, *args)
    report.data = []
    subject_class.send(report_method, *args).each do |date, count|
      report.data << { x: date, y: count }
    end
  end

  def self.add_counts(report, subject_class, query_column = 'created_at')
    report.total      = subject_class.count
    report.prev30Days = subject_class.where("#{query_column} >= ? and #{query_column} < ?", report.start_date - 30.days, report.start_date).count
  end

  def self.report_users_by_trust_level(report)
    report.data = []
    User.real.group('trust_level').count.each do |level, count|
      report.data << { x: level.to_i, y: count }
    end
  end

  # Post action counts:
  def self.report_flags(report)
    basic_report_about report, PostAction, :flag_count_by_date, report.start_date, report.end_date, report.category_id
    countable = PostAction.where(post_action_type_id: PostActionType.flag_types_without_custom.values)
    countable = countable.joins(post: :topic).where("topics.category_id = ?", report.category_id) if report.category_id
    add_counts report, countable, 'post_actions.created_at'
  end

  def self.report_likes(report)
    post_action_report report, PostActionType.types[:like]
  end

  def self.report_bookmarks(report)
    post_action_report report, PostActionType.types[:bookmark]
  end

  def self.post_action_report(report, post_action_type)
    report.data = []
    PostAction.count_per_day_for_type(post_action_type, category_id: report.category_id, start_date: report.start_date, end_date: report.end_date).each do |date, count|
      report.data << { x: date, y: count }
    end
    countable = PostAction.unscoped.where(post_action_type_id: post_action_type)
    countable = countable.joins(post: :topic).where("topics.category_id = ?", report.category_id) if report.category_id
    add_counts report, countable, 'post_actions.created_at'
  end

  # Private messages counts:

  def self.private_messages_report(report, topic_subtype)
    basic_report_about report, Topic, :private_message_topics_count_per_day, report.start_date, report.end_date, topic_subtype
    add_counts report, Topic.private_messages.with_subtype(topic_subtype), 'topics.created_at'
  end

  def self.report_user_to_user_private_messages(report)
    private_messages_report report, TopicSubtype.user_to_user
  end

  def self.report_user_to_user_private_messages_with_replies(report)
    topic_subtype = TopicSubtype.user_to_user
    basic_report_about report, Post, :private_messages_count_per_day, report.start_date, report.end_date, topic_subtype
    add_counts report, Post.private_posts.with_topic_subtype(topic_subtype), 'posts.created_at'
  end

  def self.report_system_private_messages(report)
    private_messages_report report, TopicSubtype.system_message
  end

  def self.report_moderator_warning_private_messages(report)
    private_messages_report report, TopicSubtype.moderator_warning
  end

  def self.report_notify_moderators_private_messages(report)
    private_messages_report report, TopicSubtype.notify_moderators
  end

  def self.report_notify_user_private_messages(report)
    private_messages_report report, TopicSubtype.notify_user
  end

  def self.report_web_crawlers(report)
    report.data = WebCrawlerRequest.where('date >= ? and date <= ?', report.start_date, report.end_date)
      .limit(200)
      .order('sum_count DESC')
      .group(:user_agent).sum(:count)
      .map { |ua, count| { x: ua, y: count } }
  end

  def self.report_users_by_type(report)
    report.data = []

    label = Proc.new { |key| I18n.t("reports.users_by_type.xaxis_labels.#{key}") }

    admins = User.real.admins.count
    report.data << { x: label.call("admin"), y: admins } if admins > 0

    moderators = User.real.moderators.count
    report.data << { x: label.call("moderator"), y: moderators } if moderators > 0

    suspended = User.real.suspended.count
    report.data << { x: label.call("suspended"), y: suspended } if suspended > 0

    silenced = User.real.silenced.count
    report.data << { x: label.call("silenced"), y: silenced } if silenced > 0
  end

  def self.report_trending_search(report)
    report.data = []

    trends = SearchLog.select("term,
       COUNT(*) AS searches,
       SUM(CASE
               WHEN search_result_id IS NOT NULL THEN 1
               ELSE 0
           END) AS click_through,
       COUNT(DISTINCT ip_address) AS unique")
      .where('created_at > ?  AND created_at <= ?', report.start_date, report.end_date)
      .group(:term)
      .order('COUNT(DISTINCT ip_address) DESC, COUNT(*) DESC')
      .limit(20).to_a

    report.labels = [:term, :searches, :unique].map { |key|
      I18n.t("reports.trending_search.labels.#{key}")
    }

    trends.each do |trend|
      report.data << [trend.term, trend.searches, trend.unique]
    end
  end
end
