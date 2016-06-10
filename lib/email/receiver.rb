require "digest"
require_dependency "new_post_manager"
require_dependency "post_action_creator"
require_dependency "email/html_cleaner"

module Email

  class Receiver
    include ActionView::Helpers::NumberHelper

    class ProcessingError              < StandardError; end
    class EmptyEmailError              < ProcessingError; end
    class ScreenedEmailError           < ProcessingError; end
    class UserNotFoundError            < ProcessingError; end
    class AutoGeneratedEmailError      < ProcessingError; end
    class AutoGeneratedEmailReplyError < ProcessingError; end
    class BouncedEmailError            < ProcessingError; end
    class NoBodyDetectedError          < ProcessingError; end
    class InactiveUserError            < ProcessingError; end
    class BlockedUserError             < ProcessingError; end
    class BadDestinationAddress        < ProcessingError; end
    class StrangersNotAllowedError     < ProcessingError; end
    class InsufficientTrustLevelError  < ProcessingError; end
    class ReplyUserNotMatchingError    < ProcessingError; end
    class TopicNotFoundError           < ProcessingError; end
    class TopicClosedError             < ProcessingError; end
    class InvalidPost                  < ProcessingError; end
    class InvalidPostAction            < ProcessingError; end

    attr_reader :incoming_email

    def initialize(mail_string)
      raise EmptyEmailError if mail_string.blank?
      @staged_users_created = 0
      @raw_email = mail_string
      @mail = Mail.new(@raw_email)
      @message_id = @mail.message_id.presence || Digest::MD5.hexdigest(mail_string)
    end

    def process!
      return if is_blacklisted?
      @from_email, @from_display_name = parse_from_field
      @incoming_email = find_or_create_incoming_email
      process_internal
    rescue => e
      @incoming_email.update_columns(error: e.to_s) if @incoming_email
      raise
    end

    def is_blacklisted?
      return false if SiteSetting.ignore_by_title.blank?
      Regexp.new(SiteSetting.ignore_by_title) =~ @mail.subject
    end

    def find_or_create_incoming_email
      IncomingEmail.find_or_create_by(message_id: @message_id) do |ie|
        ie.raw = @raw_email
        ie.subject = subject
        ie.from_address = @from_email
        ie.to_addresses = @mail.to.map(&:downcase).join(";") if @mail.to.present?
        ie.cc_addresses = @mail.cc.map(&:downcase).join(";") if @mail.cc.present?
      end
    end

    def process_internal
      raise ScreenedEmailError if ScreenedEmail.should_block?(@from_email)

      user = find_or_create_user(@from_email, @from_display_name)

      raise UserNotFoundError if user.nil?

      @incoming_email.update_columns(user_id: user.id)

      raise BouncedEmailError if is_bounce?
      raise InactiveUserError if !user.active && !user.staged
      raise BlockedUserError  if user.blocked

      body, @elided = select_body
      body ||= ""

      raise NoBodyDetectedError if body.blank? && !@mail.has_attachments?

      if is_auto_generated?
        @incoming_email.update_columns(is_auto_generated: true)
        raise AutoGeneratedEmailReplyError if check_reply_to_auto_generated_header
        raise AutoGeneratedEmailError      if SiteSetting.block_auto_generated_emails?
      end

      if action = subscription_action_for(body, subject)
        message = SubscriptionMailer.send(action, user)
        Email::Sender.new(message, :subscription).send
      elsif post = find_related_post
        create_reply(user: user,
                     raw: body,
                     post: post,
                     topic: post.topic,
                     skip_validations: user.staged?)
      else
        destination = destinations.first

        raise BadDestinationAddress if destination.blank?

        case destination[:type]
        when :group
          group = destination[:obj]
          create_topic(user: user,
                       raw: body,
                       title: subject,
                       archetype: Archetype.private_message,
                       target_group_names: [group.name],
                       is_group_message: true,
                       skip_validations: true)

        when :category
          category = destination[:obj]

          raise StrangersNotAllowedError    if user.staged? && !category.email_in_allow_strangers
          raise InsufficientTrustLevelError if !user.has_trust_level?(SiteSetting.email_in_min_trust)

          create_topic(user: user,
                       raw: body,
                       title: subject,
                       category: category.id,
                       skip_validations: user.staged?)

        when :reply
          email_log = destination[:obj]

          raise ReplyUserNotMatchingError if email_log.user_id != user.id

          create_reply(user: user,
                       raw: body,
                       post: email_log.post,
                       topic: email_log.post.topic)
        end
      end
    end

    SOFT_BOUNCE_SCORE ||= 1
    HARD_BOUNCE_SCORE ||= 2

    def is_bounce?
      return false unless @mail.bounced? || verp

      @incoming_email.update_columns(is_bounce: true)

      if verp
        bounce_key = verp[/\+verp-(\h{32})@/, 1]
        if bounce_key && (email_log = EmailLog.find_by(bounce_key: bounce_key))
          email_log.update_columns(bounced: true)

          if @mail.error_status.present?
            if @mail.error_status.start_with?("4.")
              Email::Receiver.update_bounce_score(email_log.user.email, SOFT_BOUNCE_SCORE)
            elsif @mail.error_status.start_with?("5.")
              Email::Receiver.update_bounce_score(email_log.user.email, HARD_BOUNCE_SCORE)
            end
          elsif is_auto_generated?
            Email::Receiver.update_bounce_score(email_log.user.email, HARD_BOUNCE_SCORE)
          end
        end
      end

      true
    end

    def verp
      @verp ||= all_destinations.select { |to| to[/\+verp-\h{32}@/] }.first
    end

    def self.update_bounce_score(email, score)
      # only update bounce score once per day
      key = "bounce_score:#{email}:#{Date.today}"

      if $redis.setnx(key, "1")
        $redis.expire(key, 25.hours)

        if user = User.find_by(email: email)
          user.user_stat.bounce_score += score
          user.user_stat.reset_bounce_score_after = 30.days.from_now
          user.user_stat.save

          if user.user_stat.bounce_score >= SiteSetting.bounce_score_threshold
            StaffActionLogger.new(Discourse.system_user).log_revoke_email(user)
          end
        end

        true
      else
        false
      end
    end

    def is_auto_generated?
      return false if SiteSetting.auto_generated_whitelist.split('|').include?(@from_email)
      @mail[:precedence].to_s[/list|junk|bulk|auto_reply/i] ||
      @mail[:from].to_s[/(mailer-?daemon|postmaster|noreply)@/i] ||
      @mail.header.to_s[/auto[\-_]?(response|submitted|replied|reply|generated|respond)|holidayreply|machinegenerated/i]
    end

    def select_body
      text = nil
      html = nil

      if @mail.multipart?
        text = fix_charset(@mail.text_part)
        html = fix_charset(@mail.html_part)
      elsif @mail.content_type.to_s["text/html"]
        html = fix_charset(@mail)
      else
        text = fix_charset(@mail)
      end

      if html.present? && (SiteSetting.incoming_email_prefer_html || text.blank?)
        html = Email::HtmlCleaner.new(html).output_html
        html = trim_discourse_markers(html)
        html, elided = EmailReplyTrimmer.trim(html, true)
        return [html, elided]
      end

      if text.present?
        text = trim_discourse_markers(text)
        text, elided = EmailReplyTrimmer.trim(text, true)
        return [text, elided]
      end
    end

    def fix_charset(mail_part)
      return nil if mail_part.blank? || mail_part.body.blank?

      string = mail_part.body.decoded rescue nil

      return nil if string.blank?

      # 1) use the charset provided
      if mail_part.charset.present?
        fixed = try_to_encode(string, mail_part.charset)
        return fixed if fixed.present?
      end

      # 2) try most used encodings
      try_to_encode(string, "UTF-8") || try_to_encode(string, "ISO-8859-1")
    end

    def try_to_encode(string, encoding)
      encoded = string.encode("UTF-8", encoding)
      encoded.present? && encoded.valid_encoding? ? encoded : nil
    rescue Encoding::InvalidByteSequenceError,
           Encoding::UndefinedConversionError,
           Encoding::ConverterNotFoundError
      nil
    end

    def previous_replies_regex
      @previous_replies_regex ||= /^--[- ]\n\*#{I18n.t("user_notifications.previous_discussion")}\*\n/im
    end

    def trim_discourse_markers(reply)
      reply.split(previous_replies_regex)[0]
    end

    def parse_from_field
      if @mail[:from].errors.blank?
        address_field = @mail[:from].address_list.addresses.first
        address_field.decoded
        from_address = address_field.address
        from_display_name = address_field.display_name.try(:to_s)
      else
        from_address = @mail.from[/<([^>]+)>/, 1]
        from_display_name = @mail.from[/^([^<]+)/, 1]
      end
      [from_address.downcase, from_display_name]
    end

    def subject
      @suject ||= @mail.subject.presence || I18n.t("emails.incoming.default_subject", email: @from_email)
    end

    def find_or_create_user(email, display_name)
      user = nil

      User.transaction do
        begin
          user = User.find_by_email(email)

          if user.nil? && SiteSetting.enable_staged_users
            username = UserNameSuggester.sanitize_username(display_name) if display_name.present?
            user = User.create!(
              email: email,
              username: UserNameSuggester.suggest(username.presence || email),
              name: display_name.presence || User.suggest_name(email),
              staged: true
            )
            @staged_users_created += 1
          end
        rescue
          user = nil
        end
      end

      user
    end

    def all_destinations
      @all_destinations ||= [
        @mail.destinations,
        [@mail[:x_forwarded_to]].flatten.compact.map(&:decoded),
        [@mail[:delivered_to]].flatten.compact.map(&:decoded),
      ].flatten.select(&:present?).uniq.lazy
    end

    def destinations
      all_destinations
        .map { |d| check_address(d) }
        .drop_while(&:blank?)
    end

    def check_address(address)
      # only check for a group/category when 'email_in' is enabled
      if SiteSetting.email_in
        group = Group.find_by_email(address)
        return { type: :group, obj: group } if group

        category = Category.find_by_email(address)
        return { type: :category, obj: category } if category
      end

      # reply
      match = reply_by_email_address_regex.match(address)
      if match && match.captures
        match.captures.each do |c|
          next if c.blank?
          email_log = EmailLog.for(c)
          return { type: :reply, obj: email_log } if email_log
        end
      end
    end

    def reply_by_email_address_regex
      @reply_by_email_address_regex ||= begin
        reply_addresses = [
           SiteSetting.reply_by_email_address,
          *SiteSetting.alternative_reply_by_email_addresses.split("|")
        ]
        escaped_reply_addresses = reply_addresses.select { |a| a.present? }
                                                 .map { |a| Regexp.escape(a) }
                                                 .map { |a| a.gsub(Regexp.escape("%{reply_key}"), "([[:xdigit:]]{32})") }
        Regexp.new(escaped_reply_addresses.join("|"))
      end
    end

    def group_incoming_emails_regex
      @group_incoming_emails_regex ||= Regexp.union Group.pluck(:incoming_email).select(&:present?).map { |e| e.split("|") }.flatten.uniq
    end

    def category_email_in_regex
      @category_email_in_regex ||= Regexp.union Category.pluck(:email_in).select(&:present?).map { |e| e.split("|") }.flatten.uniq
    end

    def find_related_post
      message_ids = [@mail.in_reply_to, Email::Receiver.extract_references(@mail.references)]
      message_ids.flatten!
      message_ids.select!(&:present?)
      message_ids.uniq!
      return if message_ids.empty?

      Post.where(id: IncomingEmail.where(message_id: message_ids).select(:post_id))
          .order(created_at: :desc)
          .first
    end

    def self.extract_references(references)
      if Array === references
        references
      elsif references.present?
        references.split(/[\s,]/).map { |r| r.sub(/^</, "").sub(/>$/, "") }
      end
    end

    def likes
      @likes ||= Set.new ["+1", I18n.t('post_action_types.like.title').downcase]
    end

    def subscription_action_for(body, subject)
      return unless SiteSetting.unsubscribe_via_email
      if ([subject, body].compact.map(&:to_s).map(&:downcase) & ['unsubscribe']).any?
        :confirm_unsubscribe
      end
    end

    def post_action_for(body)
      if likes.include?(body.strip.downcase)
        PostActionType.types[:like]
      end
    end

    def create_topic(options={})
      create_post_with_attachments(options)
    end

    def create_reply(options={})
      raise TopicNotFoundError if options[:topic].nil? || options[:topic].trashed?
      raise TopicClosedError   if options[:topic].closed?

      if post_action_type = post_action_for(options[:raw])
        create_post_action(options[:user], options[:post], post_action_type)
      else
        options[:topic_id] = options[:post].try(:topic_id)
        options[:reply_to_post_number] = options[:post].try(:post_number)
        options[:is_group_message] = options[:topic].private_message? && options[:topic].allowed_groups.exists?
        create_post_with_attachments(options)
      end
    end

    def create_post_action(user, post, type)
      PostActionCreator.new(user, post).perform(type)
    rescue PostAction::AlreadyActed
      # it's cool, don't care
    rescue Discourse::InvalidAccess => e
      raise InvalidPostAction.new(e)
    end

    def create_post_with_attachments(options={})
      # deal with attachments
      @mail.attachments.each do |attachment|
        tmp = Tempfile.new("discourse-email-attachment")
        begin
          # read attachment
          File.open(tmp.path, "w+b") { |f| f.write attachment.body.decoded }
          # create the upload for the user
          opts = { is_attachment_for_group_message: options[:is_group_message] }
          upload = Upload.create_for(options[:user].id, tmp, attachment.filename, tmp.size, opts)
          if upload && upload.errors.empty?
            # try to inline images
            if attachment.content_type.start_with?("image/") && options[:raw][/\[image: .+ \d+\]/]
              options[:raw].sub!(/\[image: .+ \d+\]/, attachment_markdown(upload))
            else
              options[:raw] << "\n\n#{attachment_markdown(upload)}\n\n"
            end
          end
        ensure
          tmp.try(:close!) rescue nil
        end
      end

      create_post(options)
    end

    def attachment_markdown(upload)
      if FileHelper.is_image?(upload.original_filename)
        "<img src='#{upload.url}' width='#{upload.width}' height='#{upload.height}'>"
      else
        "<a class='attachment' href='#{upload.url}'>#{upload.original_filename}</a> (#{number_to_human_size(upload.filesize)})"
      end
    end

    def create_post(options={})
      options[:via_email] = true
      options[:raw_email] = @raw_email

      # ensure posts aren't created in the future
      options[:created_at] = [@mail.date, DateTime.now].min

      is_private_message = options[:archetype] == Archetype.private_message ||
                           options[:topic].try(:private_message?)

      # only add elided part in messages
      if @elided.present? && is_private_message
        options[:raw] << "\n\n" << "<details class='elided'>" << "\n"
        options[:raw] << "<summary title='#{I18n.t('emails.incoming.show_trimmed_content')}'>&#183;&#183;&#183;</summary>" << "\n"
        options[:raw] << @elided << "\n"
        options[:raw] << "</details>" << "\n"
      end

      user = options.delete(:user)
      manager = NewPostManager.new(user, options)
      result = manager.perform

      raise InvalidPost, result.errors.full_messages.join("\n") if result.errors.any?

      if result.post
        @incoming_email.update_columns(topic_id: result.post.topic_id, post_id: result.post.id)
        if result.post.topic && result.post.topic.private_message?
          add_other_addresses(result.post.topic, user)
        end
      end
    end

    def add_other_addresses(topic, sender)
      %i(to cc bcc).each do |d|
        if @mail[d] && @mail[d].address_list && @mail[d].address_list.addresses
          @mail[d].address_list.addresses.each do |address_field|
            begin
              address_field.decoded
              email = address_field.address.downcase
              display_name = address_field.display_name.try(:to_s)
              if should_invite?(email)
                user = find_or_create_user(email, display_name)
                if user && can_invite?(topic, user)
                  topic.topic_allowed_users.create!(user_id: user.id)
                  topic.add_small_action(sender, "invited_user", user.username)
                end
                # cap number of staged users created per email
                if @staged_users_created > SiteSetting.maximum_staged_users_per_email
                  topic.add_moderator_post(sender, I18n.t("emails.incoming.maximum_staged_user_per_email_reached"))
                  return
                end
              end
            rescue ActiveRecord::RecordInvalid
              # don't care if user already allowed
            end
          end
        end
      end
    end

    def should_invite?(email)
      email !~ reply_by_email_address_regex &&
      email !~ group_incoming_emails_regex &&
      email !~ category_email_in_regex
    end

    def can_invite?(topic, user)
      !topic.topic_allowed_users.where(user_id: user.id).exists? &&
      !topic.topic_allowed_groups.where("group_id IN (SELECT group_id FROM group_users WHERE user_id = ?)", user.id).exists?
    end

    private

    def check_reply_to_auto_generated_header
      headers = Mail::Header.new(@mail.body.to_s.gsub("\r\n\r\n", "\r\n")).to_a

      index = headers.find_index do |f|
        f.name == Email::MessageBuilder::REPLY_TO_AUTO_GENERATED_HEADER_KEY
      end

      if index
        headers[index].value == Email::MessageBuilder::REPLY_TO_AUTO_GENERATED_HEADER_VALUE
      end
    end

  end

end
