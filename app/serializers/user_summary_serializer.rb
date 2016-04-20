class UserSummarySerializer < ApplicationSerializer

  class TopicSerializer < ApplicationSerializer
    attributes :id, :created_at, :fancy_title, :slug, :like_count
  end

  class ReplySerializer < ApplicationSerializer
    attributes :post_number, :like_count, :created_at
    has_one :topic, serializer: TopicSerializer
  end

  class LinkSerializer < ApplicationSerializer
    attributes :url, :title, :clicks, :post_number
    has_one :topic, serializer: TopicSerializer

    def post_number
      object.post.post_number
    end
  end

  class MostLikedByUserSerializer < BasicUserSerializer
    attributes :likes, :name
  end

  has_many :topics, serializer: TopicSerializer
  has_many :replies, serializer: ReplySerializer, embed: :object
  has_many :links, serializer: LinkSerializer, embed: :object
  has_many :most_liked_by_users, serializer: MostLikedByUserSerializer, embed: :object
  has_many :badges, serializer: UserBadgeSerializer, embed: :object

  attributes :likes_given,
             :likes_received,
             :posts_read_count,
             :days_visited,
             :topic_count,
             :post_count,
             :time_read,
             :bookmark_count

  def include_badges?
    SiteSetting.enable_badges
  end

  def time_read
    AgeWords.age_words(object.time_read)
  end
end
