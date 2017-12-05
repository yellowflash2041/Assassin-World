class UserField < ActiveRecord::Base

  include AnonCacheInvalidator

  validates_presence_of :name, :description, :field_type
  has_many :user_field_options, dependent: :destroy
  accepts_nested_attributes_for :user_field_options

  def self.max_length
    2048
  end
end

# == Schema Information
#
# Table name: user_fields
#
#  id                :integer          not null, primary key
#  name              :string(255)      not null
#  field_type        :string(255)      not null
#  created_at        :datetime
#  updated_at        :datetime
#  editable          :boolean          default(FALSE), not null
#  description       :string(255)      not null
#  required          :boolean          default(TRUE), not null
#  show_on_profile   :boolean          default(FALSE), not null
#  position          :integer          default(0)
#  show_on_user_card :boolean          default(FALSE), not null
#
