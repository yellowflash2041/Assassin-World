# frozen_string_literal: true

class SidebarSectionLink < ActiveRecord::Base
  belongs_to :user
  belongs_to :linkable, polymorphic: true

  validates :user_id, presence: true, uniqueness: { scope: [:linkable_type, :linkable_id] }
  validates :linkable_id, presence: true
  validates :linkable_type, presence: true
  validate :ensure_supported_linkable_type, if: :will_save_change_to_linkable_type?

  SUPPORTED_LINKABLE_TYPES = %w{Category Tag}

  private def ensure_supported_linkable_type
    if (!SUPPORTED_LINKABLE_TYPES.include?(self.linkable_type)) || (self.linkable_type == 'Tag' && !SiteSetting.tagging_enabled)
      self.errors.add(:linkable_type, I18n.t("activerecord.errors.models.sidebar_section_link.attributes.linkable_type.invalid"))
    end
  end
end

# == Schema Information
#
# Table name: sidebar_section_links
#
#  id            :bigint           not null, primary key
#  user_id       :integer          not null
#  linkable_id   :integer          not null
#  linkable_type :string           not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#
# Indexes
#
#  idx_unique_sidebar_section_links  (user_id,linkable_type,linkable_id) UNIQUE
#
