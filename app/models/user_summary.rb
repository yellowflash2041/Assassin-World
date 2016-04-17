# ViewModel used on Summary tab on User page

class UserSummary

  MAX_SUMMARY_RESULTS = 6
  MAX_BADGES = 6

  alias :read_attribute_for_serialization :send

  def initialize(user, guardian)
    @user = user
    @guardian = guardian
  end

  def topics
    Topic
      .secured(@guardian)
      .listable_topics
      .visible
      .where(user: @user)
      .order('like_count DESC, created_at ASC')
      .includes(:user, :category)
      .limit(MAX_SUMMARY_RESULTS)
  end

  def replies
    Post
      .secured(@guardian)
      .includes(:user, topic: :category)
      .references(:topic)
      .merge(Topic.listable_topics.visible.secured(@guardian))
      .where(user: @user)
      .where('post_number > 1')
      .where('topics.archetype <> ?', Archetype.private_message)
      .order('posts.like_count DESC, posts.created_at ASC')
      .limit(MAX_SUMMARY_RESULTS)
  end

  def links
    TopicLink
      .where(user: @user)
      .where(internal: false)
      .where(reflection: false)
      .order('clicks DESC, created_at ASC')
      .limit(MAX_SUMMARY_RESULTS)
  end

  class LikedByUser < OpenStruct
    include ActiveModel::SerializerSupport
  end

  def most_liked_by_users
    likers_ids = []
    counts = []
    UserAction.joins("JOIN posts  ON posts.id  = user_actions.target_post_id")
              .joins("JOIN topics ON topics.id = posts.topic_id")
              .where("posts.deleted_at  IS NULL")
              .where("topics.deleted_at IS NULL")
              .where("topics.archetype <> '#{Archetype.private_message}'")
              .where(user: @user)
              .where(action_type: UserAction::WAS_LIKED)
              .group(:acting_user_id)
              .order("COUNT(*) DESC")
              .limit(MAX_SUMMARY_RESULTS)
              .pluck("acting_user_id, COUNT(*)")
              .each do |i|
                likers_ids << i[0]
                counts << i[1]
              end

    User.where(id: likers_ids)
        .pluck(:id, :username, :name, :uploaded_avatar_id)
        .map.with_index do |u, i|
      LikedByUser.new(
        id: u[0],
        username: u[1],
        name: u[2],
        avatar_template: User.avatar_template(u[1], u[3]),
        likes: counts[i]
      )
    end
  end

  def badges
    @user.featured_user_badges(MAX_BADGES)
  end

  def user_stat
    @user.user_stat
  end

  def bookmark_count
    UserAction
      .where(user: @user)
      .where(action_type: UserAction::BOOKMARK)
      .count
  end

  delegate :likes_given,
           :likes_received,
           :days_visited,
           :posts_read_count,
           :topic_count,
           :post_count,
           :time_read,
           to: :user_stat

end
