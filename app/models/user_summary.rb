# ViewModel used on Summary tab on User page

class UserSummary

  MAX_FEATURED_BADGES = 7
  MAX_TOPICS = 6

  alias :read_attribute_for_serialization :send

  def initialize(user, guardian)
    @user = user
    @guardian = guardian
  end

  def topics
    Topic
      .secured(@guardian)
      .listable_topics
      .where(user: @user)
      .order('like_count desc, created_at asc')
      .includes(:user, :category)
      .limit(MAX_TOPICS)
  end

  def replies
    Post
      .secured(@guardian)
      .where(user: @user)
      .where('post_number > 1')
      .where('topics.archetype <> ?', Archetype.private_message)
      .order('posts.like_count desc, posts.created_at asc')
      .includes(:user, {topic: :category})
      .references(:topic)
      .limit(MAX_TOPICS)
  end

  def badges
    user_badges = @user.user_badges
    user_badges = user_badges.group(:badge_id)
                      .select(UserBadge.attribute_names.map {|x|
                        "MAX(#{x}) as #{x}" }, 'COUNT(*) as count')
                        .includes(badge: [:badge_grouping, :badge_type])
                        .includes(post: :topic)
                        .includes(:granted_by)
                        .limit(MAX_FEATURED_BADGES)
  end

  def user_stat
    @user.user_stat
  end

  delegate :likes_given, :likes_received, :days_visited,
           :posts_read_count, :topic_count, :post_count,
           to: :user_stat

end
