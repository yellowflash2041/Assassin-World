# frozen_string_literal: true

require 'sanitize'

class Search

  class GroupedSearchResults
    include ActiveModel::Serialization

    class TextHelper
      extend ActionView::Helpers::TextHelper
    end

    attr_reader(
      :type_filter,
      :posts,
      :categories,
      :users,
      :tags,
      :groups,
      :more_posts,
      :more_categories,
      :more_users,
      :term,
      :search_context,
      :more_full_page_results,
      :error
    )

    attr_accessor :search_log_id

    BLURB_LENGTH = 200

    def initialize(type_filter:, term:, search_context:, blurb_length: nil, blurb_term: nil)
      @type_filter = type_filter
      @term = term
      @blurb_term = blurb_term || term
      @search_context = search_context
      @blurb_length = blurb_length || BLURB_LENGTH
      @posts = []
      @categories = []
      @users = []
      @tags = []
      @groups = []
      @error = nil
    end

    def error=(error)
      @error = error
    end

    def find_user_data(guardian)
      if user = guardian.user
        topics = @posts.map(&:topic)
        topic_lookup = TopicUser.lookup_for(user, topics)
        topics.each { |ft| ft.user_data = topic_lookup[ft.id] }
      end
    end

    def blurb(post)
      opts = {
        term: @blurb_term,
        blurb_length: @blurb_length
      }

      if post.post_search_data.version > SearchIndexer::MIN_POST_REINDEX_VERSION
        opts[:cooked] = post.post_search_data.raw_data
        opts[:scrub] = false
      else
        opts[:cooked] = post.cooked
      end

      GroupedSearchResults.blurb_for(**opts)
    end

    def add(object)
      type = object.class.to_s.downcase.pluralize

      if @type_filter.present? && public_send(type).length == Search.per_filter
        @more_full_page_results = true
      elsif !@type_filter.present? && public_send(type).length == Search.per_facet
        instance_variable_set("@more_#{type}".to_sym, true)
      else
        (self.public_send(type)) << object
      end
    end

    def self.blurb_for(cooked: nil, term: nil, blurb_length: BLURB_LENGTH, scrub: true)
      blurb = nil
      cooked = SearchIndexer.scrub_html_for_search(cooked) if scrub

      urls = Set.new
      cooked.scan(URI.regexp(%w{http https})) { urls << $& }
      urls.each do |url|
        begin
          case File.extname(URI(url).path || "")
          when Oneboxer::VIDEO_REGEX
            cooked.gsub!(url, I18n.t("search.video"))
          when Oneboxer::AUDIO_REGEX
            cooked.gsub!(url, I18n.t("search.audio"))
          end
        rescue URI::InvalidURIError
        end
      end

      if term
        if term =~ Regexp.new(Search::PHRASE_MATCH_REGEXP_PATTERN)
          term = Regexp.last_match[1]
        end

        blurb = TextHelper.excerpt(cooked, term,
          radius: blurb_length / 2
        )
      end

      blurb = TextHelper.truncate(cooked, length: blurb_length) if blurb.blank?
      Sanitize.clean(blurb)
    end
  end

end
