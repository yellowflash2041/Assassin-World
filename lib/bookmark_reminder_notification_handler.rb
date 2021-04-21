# frozen_string_literal: true

class BookmarkReminderNotificationHandler
  def self.send_notification(bookmark)
    return if bookmark.blank?
    Bookmark.transaction do
      if bookmark.post.blank? || bookmark.post.deleted_at.present?
        clear_reminder(bookmark)
      elsif bookmark.topic
        create_notification(bookmark)

        if bookmark.auto_delete_when_reminder_sent?
          BookmarkManager.new(bookmark.user).destroy(bookmark.id)
        end

        clear_reminder(bookmark)
      end
    end
  end

  def self.clear_reminder(bookmark)
    Rails.logger.debug(
      "Clearing bookmark reminder for bookmark_id #{bookmark.id}. reminder info: #{bookmark.reminder_at} | #{Bookmark.reminder_types[bookmark.reminder_type]}"
    )

    bookmark.clear_reminder!
  end

  def self.create_notification(bookmark)
    user = bookmark.user
    user.notifications.create!(
      notification_type: Notification.types[:bookmark_reminder],
      topic_id: bookmark.topic_id,
      post_number: bookmark.post.post_number,
      data: {
        topic_title: bookmark.topic.title,
        display_username: user.username,
        bookmark_name: bookmark.name
      }.to_json
    )
  end
end
