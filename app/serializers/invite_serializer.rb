# frozen_string_literal: true

class InviteSerializer < ApplicationSerializer
  attributes :id,
             :link,
             :email,
             :emailed,
             :redemption_count,
             :max_redemptions_allowed,
             :custom_message,
             :updated_at,
             :expires_at,
             :expired

  has_many :topics, embed: :object, serializer: BasicTopicSerializer
  has_many :groups, embed: :object, serializer: BasicGroupSerializer

  def include_email?
    options[:show_emails] && !object.redeemed?
  end

  def include_emailed?
    email.present?
  end

  def emailed
    object.emailed_status != Invite.emailed_status_types[:not_required]
  end

  def expired
    object.expired?
  end
end
