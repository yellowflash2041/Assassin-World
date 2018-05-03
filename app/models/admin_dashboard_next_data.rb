class AdminDashboardNextData
  include StatsCacheable

  REPORTS = [ "visits", "posts", "time_to_first_response", "likes", "flags" ]

  def initialize(opts = {})
    @opts = opts
  end

  def self.fetch_stats
    AdminDashboardNextData.new.as_json
  end

  def self.stats_cache_key
    'dash-next-stats'
  end

  def as_json(_options = nil)
    @json ||= {
      reports: AdminDashboardNextData.reports(REPORTS),
      last_backup_taken_at: last_backup_taken_at,
      updated_at: Time.zone.now.as_json
    }
  end

  def last_backup_taken_at
    if last_backup = Backup.all.last
      File.ctime(last_backup.path).utc
    end
  end

  def self.reports(source)
    source.map { |type| Report.find(type).as_json }
  end
end
