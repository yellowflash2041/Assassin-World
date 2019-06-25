# frozen_string_literal: true

require_dependency 'notification_levels'

class CategoryUser < ActiveRecord::Base
  belongs_to :category
  belongs_to :user

  def self.lookup(user, level)
    self.where(user: user, notification_level: notification_levels[level])
  end

  def self.notification_levels
    NotificationLevels.all
  end

  def self.watching_levels
    [notification_levels[:watching], notification_levels[:watching_first_post]]
  end

  def self.batch_set(user, level, category_ids)
    level_num = notification_levels[level]
    category_ids = Category.where(id: category_ids).pluck(:id)

    changed = false

    # Update pre-existing category users
    if category_ids.present? && CategoryUser
        .where(user_id: user.id, category_id: category_ids)
        .where.not(notification_level: level_num)
        .update_all(notification_level: level_num) > 0

      changed = true
    end

    # Remove extraneous category users
    if CategoryUser.where(user_id: user.id, notification_level: level_num)
        .where.not(category_id: category_ids)
        .delete_all > 0

      changed = true
    end

    if category_ids.present?
      params = {
        user_id: user.id,
        level_num: level_num,
      }

      sql = <<~SQL
        INSERT INTO category_users (user_id, category_id, notification_level)
        SELECT :user_id, :category_id, :level_num
        ON CONFLICT DO NOTHING
      SQL

      # we could use VALUES here but it would introduce a string
      # into the query, plus it is a bit of a micro optimisation
      category_ids.each do |category_id|
        params[:category_id] = category_id
        if DB.exec(sql, params) > 0
          changed = true
        end
      end

    end

    if changed
      auto_watch(user_id: user.id)
      auto_track(user_id: user.id)
    end

    changed
  end

  def self.set_notification_level_for_category(user, level, category_id)
    record = CategoryUser.where(user: user, category_id: category_id).first

    return if record && record.notification_level == level

    if record.present?
      record.notification_level = level
      record.save!
    else
      begin
        CategoryUser.create!(user: user, category_id: category_id, notification_level: level)
      rescue ActiveRecord::RecordNotUnique
        # does not matter
      end
    end

    auto_watch(user_id: user.id)
    auto_track(user_id: user.id)
  end

  def self.auto_track(opts = {})

    builder = DB.build <<~SQL
      UPDATE topic_users tu
      SET notification_level = :tracking,
          notifications_reason_id = :auto_track_category
      FROM topics t, category_users cu
      /*where*/
    SQL

    builder.where("tu.topic_id = t.id AND
                  cu.category_id = t.category_id AND
                  cu.user_id = tu.user_id AND
                  cu.notification_level = :tracking AND
                  tu.notification_level = :regular")

    if category_id = opts[:category_id]
      builder.where("t.category_id = :category_id", category_id: category_id)
    end

    if topic_id = opts[:topic_id]
      builder.where("tu.topic_id = :topic_id", topic_id: topic_id)
    end

    if user_id = opts[:user_id]
      builder.where("tu.user_id = :user_id", user_id: user_id)
    end

    builder.exec(
      tracking: notification_levels[:tracking],
      regular: notification_levels[:regular],
      auto_track_category: TopicUser.notification_reasons[:auto_track_category]
    )
  end

  def self.auto_watch(opts = {})

    builder = DB.build <<~SQL
      UPDATE topic_users tu
      SET notification_level =
        CASE WHEN should_track THEN :tracking
             WHEN should_watch THEN :watching
             ELSE notification_level
        END,
      notifications_reason_id =
        CASE WHEN should_track THEN null
             WHEN should_watch THEN :auto_watch_category
             ELSE notifications_reason_id
             END
      FROM (
        SELECT tu1.topic_id,
               tu1.user_id,
               CASE WHEN
                  cu.user_id IS NULL AND tu1.notification_level = :watching AND tu1.notifications_reason_id = :auto_watch_category THEN true
                    ELSE false
               END should_track,
               CASE WHEN
                  cu.user_id IS NOT NULL AND tu1.notification_level in (:regular, :tracking) THEN true
                  ELSE false
               END should_watch

        FROM topic_users tu1
        JOIN topics t ON t.id = tu1.topic_id
        LEFT JOIN category_users cu ON cu.category_id = t.category_id AND cu.user_id = tu1.user_id AND cu.notification_level = :watching
        /*where2*/
      ) as X

      /*where*/
    SQL

    builder.where("X.topic_id = tu.topic_id AND X.user_id = tu.user_id")
    builder.where("should_watch OR should_track")

    if category_id = opts[:category_id]
      builder.where2("t.category_id = :category_id", category_id: category_id)
    end

    if topic_id = opts[:topic_id]
      builder.where("tu.topic_id = :topic_id", topic_id: topic_id)
      builder.where2("tu1.topic_id = :topic_id", topic_id: topic_id)
    end

    if user_id = opts[:user_id]
      builder.where("tu.user_id = :user_id", user_id: user_id)
      builder.where2("tu1.user_id = :user_id", user_id: user_id)
    end

    builder.exec(
      watching: notification_levels[:watching],
      tracking: notification_levels[:tracking],
      regular: notification_levels[:regular],
      auto_watch_category: TopicUser.notification_reasons[:auto_watch_category]
    )

  end

  def self.ensure_consistency!
    DB.exec <<~SQL
      DELETE FROM category_users
        WHERE user_id IN (
          SELECT cu.user_id FROM category_users cu
          LEFT JOIN users u ON u.id = cu.user_id
          WHERE u.id IS NULL
        )
    SQL
  end

end

# == Schema Information
#
# Table name: category_users
#
#  id                 :integer          not null, primary key
#  category_id        :integer          not null
#  user_id            :integer          not null
#  notification_level :integer          not null
#
# Indexes
#
#  idx_category_users_category_id_user_id  (category_id,user_id) UNIQUE
#  idx_category_users_user_id_category_id  (user_id,category_id) UNIQUE
#
