# frozen_string_literal: true

require 'net/imap'

module Imap
  module Providers
    class Generic

      def initialize(server, options = {})
        @server = server
        @port = options[:port] || 993
        @ssl = options[:ssl] || true
        @username = options[:username]
        @password = options[:password]
        @timeout = options[:timeout] || 10
      end

      def imap
        @imap ||= Net::IMAP.new(@server, port: @port, ssl: @ssl, open_timeout: @timeout)
      end

      def disconnected?
        @imap && @imap.disconnected?
      end

      def connect!
        imap.login(@username, @password)
      end

      def disconnect!
        imap.logout rescue nil
        imap.disconnect
      end

      def can?(capability)
        @capabilities ||= imap.responses['CAPABILITY'][-1] || imap.capability
        @capabilities.include?(capability)
      end

      def uids(opts = {})
        if opts[:from] && opts[:to]
          imap.uid_search("UID #{opts[:from]}:#{opts[:to]}")
        elsif opts[:from]
          imap.uid_search("UID #{opts[:from]}:*")
        elsif opts[:to]
          imap.uid_search("UID 1:#{opts[:to]}")
        else
          imap.uid_search('ALL')
        end
      end

      def labels
        @labels ||= begin
          labels = {}

          list_mailboxes.each do |name|
            if tag = to_tag(name)
              labels[tag] = name
            end
          end

          labels
        end
      end

      def open_mailbox(mailbox_name, write: false)
        if write
          raise 'two-way IMAP sync is disabled' if !SiteSetting.enable_imap_write
          imap.select(mailbox_name)
        else
          imap.examine(mailbox_name)
        end

        {
          uid_validity: imap.responses['UIDVALIDITY'][-1]
        }
      end

      def emails(uids, fields, opts = {})
        imap.uid_fetch(uids, fields).map do |email|
          attributes = {}

          fields.each do |field|
            attributes[field] = email.attr[field]
          end

          attributes
        end
      end

      def store(uid, attribute, old_set, new_set)
        additions = new_set.reject { |val| old_set.include?(val) }
        imap.uid_store(uid, "+#{attribute}", additions) if additions.length > 0
        removals = old_set.reject { |val| new_set.include?(val) }
        imap.uid_store(uid, "-#{attribute}", removals) if removals.length > 0
      end

      def to_tag(label)
        label = DiscourseTagging.clean_tag(label.to_s)
        label if label != 'inbox' && label != 'sent'
      end

      def tag_to_flag(tag)
        :Seen if tag == 'seen'
      end

      def tag_to_label(tag)
        labels[tag]
      end

      def list_mailboxes
        imap.list('', '*').map(&:name)
      end
    end
  end
end
