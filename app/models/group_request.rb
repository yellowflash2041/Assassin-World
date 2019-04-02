class GroupRequest < ActiveRecord::Base
  belongs_to :group
  belongs_to :user
end

# == Schema Information
#
# Table name: group_requests
#
#  id         :bigint(8)        not null, primary key
#  group_id   :integer
#  user_id    :integer
#  reason     :text
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_group_requests_on_group_id  (group_id)
#  index_group_requests_on_user_id   (user_id)
#
