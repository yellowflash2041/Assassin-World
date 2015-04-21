class QueuedPost < ActiveRecord::Base

  class InvalidStateTransition < StandardError; end;

  belongs_to :user
  belongs_to :topic
  belongs_to :approved_by, class_name: "User"
  belongs_to :rejected_by, class_name: "User"

  def self.states
    @states ||= Enum.new(:new, :approved, :rejected)
  end

  # By default queues are hidden from moderators
  def self.visible_queues
    @visible_queues ||= Set.new(['default'])
  end

  def self.visible
    where(queue: visible_queues.to_a)
  end

  def self.new_count
    visible.where(state: states[:new]).count
  end

  def visible?
    QueuedPost.visible_queues.include?(queue)
  end

  def self.broadcast_new!
    msg = { post_queue_new_count: QueuedPost.new_count }
    MessageBus.publish('/queue_counts', msg, user_ids: User.staff.pluck(:id))
  end

  def reject!(rejected_by)
    change_to!(:rejected, rejected_by)
  end

  def create_options
    opts = {raw: raw}
    opts.merge!(post_options.symbolize_keys)

    opts[:cooking_options].symbolize_keys! if opts[:cooking_options]
    opts[:topic_id] = topic_id if topic_id
    opts
  end

  def approve!(approved_by)
    created_post = nil
    QueuedPost.transaction do
      change_to!(:approved, approved_by)

      creator = PostCreator.new(user, create_options.merge(skip_validations: true))
      created_post = creator.create
    end
    created_post
  end

  private

    def change_to!(state, changed_by)
      state_val = QueuedPost.states[state]

      updates = { state: state_val,
                  "#{state}_by_id" => changed_by.id,
                  "#{state}_at" => Time.now }

      # We use an update with `row_count` trick here to avoid stampeding requests to
      # update the same row simultaneously. Only one state change should go through and
      # we can use the DB to enforce this
      row_count = QueuedPost.where('id = ? AND state <> ?', id, state_val).update_all(updates)
      raise InvalidStateTransition.new if row_count == 0

      # Update the record in memory too, and clear the dirty flag
      updates.each {|k, v| send("#{k}=", v) }
      changes_applied

      QueuedPost.broadcast_new! if visible?
    end

end
