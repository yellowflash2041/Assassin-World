class Tag < ActiveRecord::Base
  validates :name, presence: true, uniqueness: true

  has_many :tag_users # notification settings

  has_many :topic_tags, dependent: :destroy
  has_many :topics, through: :topic_tags

  has_many :category_tags, dependent: :destroy
  has_many :categories, through: :category_tags

  has_many :tag_group_memberships
  has_many :tag_groups, through: :tag_group_memberships

  def self.tags_by_count_query(opts={})
    q = TopicTag.joins(:tag, :topic).group("topic_tags.tag_id, tags.name").order('count_all DESC')
    q = q.limit(opts[:limit]) if opts[:limit]
    q
  end

  def self.category_tags_by_count_query(category, opts={})
    tags_by_count_query(opts).where("tags.id in (select tag_id from category_tags where category_id = ?)", category.id)
                             .where("topics.category_id = ?", category.id)
  end

  def self.top_tags(limit_arg: nil, category: nil)
    limit = limit_arg || SiteSetting.max_tags_in_filter_list

    tags = DiscourseTagging.filter_allowed_tags(tags_by_count_query(limit: limit), nil, category: category)

    tags.count.map {|name, _| name}
  end

  def self.include_tags?
    SiteSetting.tagging_enabled && SiteSetting.show_filter_by_tag
  end

  def full_url
    "#{Discourse.base_url}/tags/#{self.name}"
  end
end

# == Schema Information
#
# Table name: tags
#
#  id          :integer          not null, primary key
#  name        :string           not null
#  topic_count :integer          default(0), not null
#  created_at  :datetime
#  updated_at  :datetime
#
# Indexes
#
#  index_tags_on_name  (name) UNIQUE
#
