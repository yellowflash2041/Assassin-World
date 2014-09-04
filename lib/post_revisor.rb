require 'edit_rate_limiter'

class PostRevisor

  attr_reader :category_changed

  def initialize(post)
    @post = post
  end

  # Recognized options:
  #  :edit_reason User-supplied edit reason
  #  :new_user New owner of the post
  #  :revised_at changes the date of the revision
  #  :force_new_version bypass ninja-edit window
  #  :bypass_bump do not bump the topic, even if last post
  #  :skip_validation ask ActiveRecord to skip validations
  #
  def revise!(editor, new_raw, opts = {})
    @editor = editor
    @opts = opts
    @new_raw = TextCleaner.normalize_whitespaces(new_raw).gsub(/\s+\z/, "")

    return false unless should_revise?

    @post.acting_user = @editor

    Post.transaction do
      revise_post

      # TODO these callbacks are being called in a transaction
      #  it is kind of odd, cause the callback is called before_edit
      #  but the post is already edited at this point
      #  trouble is that much of the logic of should I edit? is deeper
      #  down so yanking this in front of the transaction will lead to
      #  false positives. This system needs a review
      plugin_callbacks

      update_category_description
      update_topic_excerpt
      @post.advance_draft_sequence
    end

    # WARNING: do not pull this into the transaction, it can fire events in
    #  sidekiq before the post is done saving leading to corrupt state
    post_process_post
    update_topic_word_counts

    PostAlerter.new.after_save_post(@post)

    @post.publish_change_to_clients! :revised
    BadgeGranter.queue_badge_grant(Badge::Trigger::PostRevision, post: @post)

    true
  end

  private

  def should_revise?
    @post.raw != @new_raw || @opts[:changed_owner]
  end

  def revise_post
    if should_create_new_version?
      revise_and_create_new_version
    else
      update_post
    end
  end

  def plugin_callbacks
    DiscourseEvent.trigger :before_edit_post, @post
    DiscourseEvent.trigger :validate_post, @post
  end

  def get_revised_at
    @opts[:revised_at] || Time.now
  end

  def should_create_new_version?
    @post.last_editor_id != @editor.id ||
    get_revised_at - @post.last_version_at > SiteSetting.ninja_edit_window.to_i ||
    @opts[:changed_owner] == true ||
    @opts[:force_new_version] == true
  end

  def revise_and_create_new_version
    @post.version += 1
    @post.last_version_at = get_revised_at
    update_post
    EditRateLimiter.new(@editor).performed! unless @opts[:bypass_rate_limiter] == true
    bump_topic unless @opts[:bypass_bump]
  end

  def bump_topic
    unless Post.where('post_number > ? and topic_id = ?', @post.post_number, @post.topic_id).exists?
      @post.topic.update_column(:bumped_at, Time.now)
      TopicTrackingState.publish_latest(@post.topic)
    end
  end

  def update_topic_word_counts
    Topic.exec_sql("UPDATE topics SET word_count = (SELECT SUM(COALESCE(posts.word_count, 0))
                                                    FROM posts WHERE posts.topic_id = :topic_id)
                    WHERE topics.id = :topic_id", topic_id: @post.topic_id)
  end

  def update_post
    @post.raw = @new_raw
    @post.word_count = @new_raw.scan(/\w+/).size
    @post.last_editor_id = @editor.id
    @post.edit_reason = @opts[:edit_reason] if @opts[:edit_reason]
    @post.user_id = @opts[:new_user].id if @opts[:new_user]
    @post.self_edits += 1 if @editor == @post.user

    if @editor == @post.user && @post.hidden && @post.hidden_reason_id == Post.hidden_reasons[:flag_threshold_reached]
      PostAction.clear_flags!(@post, Discourse.system_user)
      @post.unhide!
    end

    @post.extract_quoted_post_numbers
    @post.save(validate: !@opts[:skip_validations])

    @post.save_reply_relationships
  end

  def update_category_description
    # If we're revising the first post, we might have to update the category description
    return unless @post.post_number == 1

    # Is there a category with our topic id?
    category = Category.find_by(topic_id: @post.topic_id)
    return unless category.present?

    # If found, update its description
    body = @post.cooked
    matches = body.scan(/\<p\>(.*)\<\/p\>/)
    if matches && matches[0] && matches[0][0]
      new_description = matches[0][0]
      new_description = nil if new_description == I18n.t("category.replace_paragraph")
      category.update_column(:description, new_description)
      @category_changed = category
    end
  end

  def update_topic_excerpt
    @post.topic.update_column(:excerpt, @post.excerpt(220, strip_links: true)) if @post.post_number == 1
  end

  def post_process_post
    @post.invalidate_oneboxes = true
    @post.trigger_post_process
  end
end
