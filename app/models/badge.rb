class Badge < ActiveRecord::Base
  # badge ids
  Welcome = 5
  NicePost = 6
  GoodPost = 7
  GreatPost = 8
  Autobiographer = 9
  Editor = 10
  FirstLike = 11
  FirstShare = 12
  FirstFlag = 13
  FirstLink = 14
  FirstQuote = 15
  ReadGuidelines = 16
  Reader = 17

  # other consts
  AutobiographerMinBioLength = 10

  def self.trigger_hash
    Hash[*(
      Badge::Trigger.constants.map{|k|
        [k.to_s.underscore, Badge::Trigger.const_get(k)]
      }.flatten
    )]
  end

  module Trigger
    None = 0
    PostAction = 1
    PostRevision = 2
    TrustLevelChange = 4
    UserChange = 8
  end

  module Queries

    Reader = <<SQL
    SELECT id user_id, current_timestamp granted_at, NULL post_id
    FROM users
    WHERE id IN
    (
      SELECT pt.user_id
      FROM post_timings pt
      JOIN badge_posts b ON b.post_number = pt.post_number AND
                            b.topic_id = pt.topic_id
      JOIN topics t ON t.id = pt.topic_id
      LEFT JOIN user_badges ub ON ub.badge_id = 17 AND ub.user_id = pt.user_id
      WHERE ub.id IS NULL AND t.posts_count > 100
      GROUP BY pt.user_id, pt.topic_id, t.posts_count
      HAVING count(*) = t.posts_count
    )
SQL

    ReadGuidelines = <<SQL
    SELECT user_id, read_faq granted_at, NULL post_id
    FROM user_stats
    WHERE read_faq IS NOT NULL
SQL

    FirstQuote = <<SQL
    SELECT ids.user_id, q.post_id, q.created_at granted_at
    FROM
    (
      SELECT p1.user_id, MIN(q1.id) id
      FROM quoted_posts q1
      JOIN badge_posts p1 ON p1.id = q1.post_id
      JOIN badge_posts p2 ON p2.id = q1.quoted_post_id
      GROUP BY p1.user_id
    ) ids
    JOIN quoted_posts q ON q.id = ids.id
SQL

    FirstLink = <<SQL
    SELECT l.user_id, l.post_id, l.created_at granted_at
    FROM
    (
      SELECT MIN(l1.id) id
      FROM topic_links l1
      JOIN badge_posts p1 ON p1.id = l1.post_id
      JOIN badge_posts p2 ON p2.id = l1.link_post_id
      WHERE NOT reflection AND p1.topic_id <> p2.topic_id AND not quote
      GROUP BY l1.user_id
    ) ids
    JOIN topic_links l ON l.id = ids.id
SQL

    FirstShare = <<SQL
    SELECT views.user_id, p2.id post_id, i2.created_at granted_at
    FROM
    (
      SELECT i.user_id, MIN(i.id) i_id
      FROM incoming_links i
      JOIN topics t on t.id = i.topic_id
      JOIN badge_posts p on p.topic_id = t.id AND p.post_number = i.post_number
      WHERE i.user_id IS NOT NULL
      GROUP BY i.user_id
    ) as views
    JOIN incoming_links i2 ON i2.id = views.i_id
    JOIN posts p2 on p2.topic_id = i2.topic_id AND p2.post_number = i2.post_number
SQL

    FirstFlag = <<SQL
    SELECT pa1.user_id, pa1.created_at granted_at, pa1.post_id
    FROM (
      SELECT pa.user_id, min(pa.id) id
      FROM post_actions pa
      JOIN badge_posts p on p.id = pa.post_id
      WHERE post_action_type_id IN (#{PostActionType.flag_types.values.join(",")})
      GROUP BY pa.user_id
    ) x
    JOIN post_actions pa1 on pa1.id = x.id
SQL

    FirstLike = <<SQL
    SELECT pa1.user_id, pa1.created_at granted_at, pa1.post_id
    FROM (
      SELECT pa.user_id, min(pa.id) id
      FROM post_actions pa
      JOIN badge_posts p on p.id = pa.post_id
      WHERE post_action_type_id = 2
      GROUP BY pa.user_id
    ) x
    JOIN post_actions pa1 on pa1.id = x.id
SQL

    # Incorrect, but good enough - (earlies post edited vs first edit)
    Editor = <<SQL
    SELECT p.user_id, min(p.id) post_id, min(p.created_at) granted_at
    FROM badge_posts p
    WHERE p.self_edits > 0
    GROUP BY p.user_id
SQL

    Welcome = <<SQL
    SELECT p.user_id, min(post_id) post_id, min(pa.created_at) granted_at
    FROM post_actions pa
    JOIN badge_posts p on p.id = pa.post_id
    WHERE post_action_type_id = 2
    GROUP BY p.user_id
SQL

    Autobiographer = <<SQL
    SELECT u.id user_id, current_timestamp granted_at, NULL post_id
    FROM users u
    JOIN user_profiles up on u.id = up.user_id
    WHERE bio_raw IS NOT NULL AND LENGTH(TRIM(bio_raw)) > #{Badge::AutobiographerMinBioLength} AND
          uploaded_avatar_id IS NOT NULL
SQL

    def self.like_badge(count)
      # we can do better with dates, but its hard work
"
    SELECT p.user_id, p.id post_id, p.updated_at granted_at
    FROM badge_posts p
    WHERE p.like_count >= #{count.to_i}
"
    end

    def self.trust_level(level)
      # we can do better with dates, but its hard work figuring this out historically
"
    SELECT u.id user_id, current_timestamp granted_at, NULL post_id FROM users u
    WHERE trust_level >= #{level.to_i}
"
    end
  end

  belongs_to :badge_type
  belongs_to :badge_grouping

  has_many :user_badges, dependent: :destroy

  validates :name, presence: true, uniqueness: true
  validates :badge_type, presence: true
  validates :allow_title, inclusion: [true, false]
  validates :multiple_grant, inclusion: [true, false]

  scope :enabled, ->{ where(enabled: true) }

  # fields that can not be edited on system badges
  def self.protected_system_fields
    [:badge_type_id, :multiple_grant, :target_posts, :show_posts, :query, :trigger, :auto_revoke, :listable]
  end


  def self.trust_level_badge_ids
    (1..4).to_a
  end

  def self.like_badge_counts
    @like_badge_counts ||= {
      NicePost => 10,
      GoodPost => 25,
      GreatPost => 50
    }
  end

  def reset_grant_count!
    self.grant_count = UserBadge.where(badge_id: id).count
    save!
  end

  def single_grant?
    !self.multiple_grant?
  end

  def system?
    id && id < 100
  end

  def default_name=(val)
    self.name ||= val
  end

  def default_badge_grouping_id=(val)
    # allow to correct orphans
    if !self.badge_grouping_id || self.badge_grouping_id < 0
      self.badge_grouping_id = val
    end
  end
end

# == Schema Information
#
# Table name: badges
#
#  id                :integer          not null, primary key
#  name              :string(255)      not null
#  description       :text
#  badge_type_id     :integer          not null
#  grant_count       :integer          default(0), not null
#  created_at        :datetime
#  updated_at        :datetime
#  allow_title       :boolean          default(FALSE), not null
#  multiple_grant    :boolean          default(FALSE), not null
#  icon              :string(255)      default("fa-certificate")
#  listable          :boolean          default(TRUE)
#  target_posts      :boolean          default(FALSE)
#  query             :text
#  enabled           :boolean          default(TRUE), not null
#  auto_revoke       :boolean          default(TRUE), not null
#  badge_grouping_id :integer          default(5), not null
#  trigger           :integer
#  show_posts        :boolean          default(FALSE), not null
#
# Indexes
#
#  index_badges_on_name  (name) UNIQUE
#
