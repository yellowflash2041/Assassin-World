require_dependency 'markdown_linker'
require_dependency 'email_builder'

class UserNotifications < ActionMailer::Base
  include EmailBuilder

  default from: SiteSetting.notification_email

  def signup(user, opts={})
    build_email(user.email, "user_notifications.signup", email_token: opts[:email_token])
  end

  def authorize_email(user, opts={})
    build_email(user.email, "user_notifications.authorize_email", email_token: opts[:email_token])
  end

  def forgot_password(user, opts={})
    build_email(user.email, "user_notifications.forgot_password", email_token: opts[:email_token])
  end

  def private_message(user, opts={})
    post = opts[:post]

    build_email user.email,
                "user_notifications.private_message",
                message: post.raw,
                url: post.url,
                subject_prefix: post.post_number != 1 ? "re: " : "",
                topic_title: post.topic.title,
                from: post.user.name,
                add_unsubscribe_link: true
  end

  def digest(user, opts={})
    @user = user
    @base_url = Discourse.base_url

    min_date = @user.last_emailed_at || @user.last_seen_at || 1.month.ago

    @site_name = SiteSetting.title

    @last_seen_at = (@user.last_seen_at || @user.created_at).strftime("%m-%d-%Y")

    # A list of new topics to show the user
    @new_topics = Topic.new_topics(min_date)
    @notifications = @user.notifications.interesting_after(min_date)

    @markdown_linker = MarkdownLinker.new(Discourse.base_url)

    # Don't send email unless there is content in it
    if @new_topics.present? or @notifications.present?
      mail to: user.email,
           subject: I18n.t('user_notifications.digest.subject_template',
                            :site_name => @site_name,
                            :date => Time.now.strftime("%m-%d-%Y"))
    end
  end

  def notification_template(user, opts)
    @notification = opts[:notification]
    return unless @notification.present?

    @post = opts[:post]
    return unless @post.present?

    notification_type = Notification.InvertedTypes[opts[:notification].notification_type].to_s
    build_email user.email,
                "user_notifications.user_#{notification_type}",
                topic_title: @notification.data_hash[:topic_title],
                message: @post.raw,
                url: @post.url,
                username: @notification.data_hash[:display_username],
                add_unsubscribe_link: true
  end
  alias :user_invited_to_private_message :notification_template
  alias :user_replied :notification_template
  alias :user_quoted :notification_template
  alias :user_mentioned :notification_template

end
