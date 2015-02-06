class ApplicationRequest < ActiveRecord::Base
  enum req_type: %i(http_total
                    http_2xx
                    http_background
                    http_3xx
                    http_4xx
                    http_5xx
                    page_view_crawler
                    page_view_logged_in
                    page_view_anon)

  cattr_accessor :autoflush, :autoflush_seconds, :last_flush
  # auto flush if backlog is larger than this
  self.autoflush = 2000

  # auto flush if older than this
  self.autoflush_seconds = 5.minutes
  self.last_flush = Time.now

  def self.increment!(type, opts=nil)
    key = redis_key(type)
    val = $redis.incr(key).to_i
    $redis.expire key, 3.days

    autoflush = (opts && opts[:autoflush]) || self.autoflush
    if autoflush > 0 && val >= autoflush
      write_cache!
      return
    end

    if (Time.now - last_flush).to_i > autoflush_seconds
      write_cache!
    end
  end

  def self.write_cache!(date=nil)
    if date.nil?
      write_cache!(Time.now.utc)
      write_cache!(Time.now.utc.yesterday)
      return
    end

    self.last_flush = Time.now

    date = date.to_date

    # this may seem a bit fancy but in so it allows
    # for concurrent calls without double counting
    req_types.each do |req_type,_|
      key = redis_key(req_type,date)
      val = $redis.get(key).to_i

      next if val == 0

      new_val = $redis.incrby(key, -val).to_i

      if new_val < 0
        # undo and flush next time
        $redis.incrby(key, val)
        next
      end

      id = req_id(date,req_type)

      where(id: id).update_all(["count = count + ?", val])
    end
  end

  def self.clear_cache!(date=nil)
    if date.nil?
      clear_cache!(Time.now.utc)
      clear_cache!(Time.now.utc.yesterday)
      return
    end

    req_types.each do |req_type,_|
      key = redis_key(req_type,date)
      $redis.del key
    end
  end

  protected

  def self.req_id(date,req_type,retries=0)

    req_type_id = req_types[req_type]

    # a poor man's upsert
    id = where(date: date, req_type: req_type_id).pluck(:id).first
    id ||= create!(date: date, req_type: req_type_id, count: 0).id

  rescue # primary key violation
    if retries == 0
      req_id(date,req_type,1)
    else
      raise
    end
  end

  def self.redis_key(req_type, time=Time.now.utc)
    "app_req_#{req_type}#{time.strftime('%Y%m%d')}"
  end

  def self.stats
    @stats ||= begin
      s = HashWithIndifferentAccess.new({
        all_total: 0,
        all_30_days: 0,
        all_7_days: 0
      })

      self.req_types.each do |key, i|
        query = self.where(req_type: i)
        s["#{key}_total"]   = query.sum(:count)
        s["#{key}_30_days"] = query.where("date > ?", 30.days.ago).sum(:count)
        s["#{key}_7_days"]  = query.where("date > ?", 7.days.ago).sum(:count)

        s[:all_total]   += s["#{key}_total"]
        s[:all_30_days] += s["#{key}_30_days"]
        s[:all_7_days]  += s["#{key}_7_days"]
      end

      s
    end
  end
end

# == Schema Information
#
# Table name: application_requests
#
#  id       :integer          not null, primary key
#  date     :date             not null
#  req_type :integer          not null
#  count    :integer          default(0), not null
#
# Indexes
#
#  index_application_requests_on_date_and_req_type  (date,req_type) UNIQUE
#
