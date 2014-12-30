class UserVisit < ActiveRecord::Base

  # A count of visits in the last month by day
  def self.by_day(start_date, end_date)
    where('visited_at >= ? and visited_at <= ?', start_date.to_date, end_date.to_date).group(:visited_at).order(:visited_at).count
  end

  def self.ensure_consistency!
    exec_sql <<SQL
    UPDATE user_stats u set days_visited =
    (
      SELECT COUNT(*) FROM user_visits v WHERE v.user_id = u.user_id
    )
    WHERE days_visited <>
    (
      SELECT COUNT(*) FROM user_visits v WHERE v.user_id = u.user_id
    )
SQL
  end
end

# == Schema Information
#
# Table name: user_visits
#
#  id         :integer          not null, primary key
#  user_id    :integer          not null
#  visited_at :date             not null
#  posts_read :integer          default(0)
#
# Indexes
#
#  index_user_visits_on_user_id_and_visited_at  (user_id,visited_at) UNIQUE
#
