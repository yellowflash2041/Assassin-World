class AdminDashboardData

  REPORTS = ['visits', 'signups', 'topics', 'posts', 'flags', 'users_by_trust_level', 'likes', 'emails']

  def self.fetch
    AdminDashboardData.new
  end

  def as_json
    @json ||= {
      reports: REPORTS.map { |type| Report.find(type) },
      problems: [rails_env_check, host_names_check, gc_checks, clockwork_check].compact
    }.merge(
      SiteSetting.version_checks? ? {version_check: DiscourseUpdates.check_version} : {}
    )
  end

  def rails_env_check
    I18n.t("dashboard.rails_env_warning", env: Rails.env) unless Rails.env == 'production'
  end

  def host_names_check
    I18n.t("dashboard.host_names_warning") if ['localhost', 'production.localhost'].include?(Discourse.current_hostname)
  end

  def gc_checks
    I18n.t("dashboard.gc_warning") if ENV['RUBY_GC_MALLOC_LIMIT'].nil?
  end

  def clockwork_check
    I18n.t('dashboard.clockwork_warning') unless Jobs::ClockworkHeartbeat.is_clockwork_running?
  end
end