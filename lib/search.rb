class Search

  def self.per_facet
    5
  end

  def self.facets
    %w(topic category user)
  end

  def self.current_locale_long
    case I18n.locale         # Currently-present in /conf/locales/* only, sorry :-( Add as needed
      when :da then 'danish'
      when :de then 'german'
      when :en then 'english'
      when :es then 'spanish'
      when :fr then 'french'
      when :it then 'italian'
      when :nl then 'dutch'
      when :pt then 'portuguese'
      when :sv then 'swedish'
      else 'simple' # use the 'simple' stemmer for other languages
    end
  end

  def initialize(term, opts=nil)
    @term = term.to_s if term.present?
    @opts = opts || {}
    @guardian = @opts[:guardian] || Guardian.new
  end

  # Query a term
  def execute

    return nil if @term.blank?

    # really short terms are totally pointless
    return nil if @term.length < (@opts[:min_search_term_length] || SiteSetting.min_search_term_length)

    # If the term is a number or url to a topic, just include that topic
    if @opts[:type_filter] == 'topic'

      begin
        route = Rails.application.routes.recognize_path(@term)
        return single_topic(route[:topic_id]) if route[:topic_id].present?
      rescue ActionController::RoutingError
      end

      return single_topic(@term.to_i) if @term =~ /^\d+$/
    end

    # We are stripping only symbols taking place in FTS and simply sanitizing the rest.
    @term = PG::Connection.escape_string(@term.gsub(/[:()&!]/,''))

    query_string
  end

  private

    # Search for a string term
    def query_string

      args = {orig: @term,
              query: @term.split.map {|t| "#{t}:*"}.join(" & "),
              locale: Search.current_locale_long}

      type_filter = @opts[:type_filter]

      if type_filter.present?
        raise Discourse::InvalidAccess.new("invalid type filter") unless Search.facets.include?(type_filter)
        args.merge!(limit: Search.per_facet * Search.facets.size)
        db_result = case type_filter.to_s
                    when 'topic'
                      post_query(type_filter.to_sym, args)
                    when 'category'
                      category_query(args)
                    when 'user'
                      user_query(args)
                    end
      else
        args.merge!(limit: (Search.per_facet + 1))
        db_result = []
        db_result += user_query(args).to_a
        db_result += category_query(args).to_a
        db_result += post_query(:topic, args).to_a
      end

      db_result = db_result.to_a

      expected_topics = 0
      expected_topics = Search.facets.size unless type_filter.present?
      expected_topics = Search.per_facet * Search.facets.size if type_filter == 'topic'

      if expected_topics > 0
        db_result.each do |row|
          expected_topics -= 1 if row['type'] == 'topic'
        end
      end

      if expected_topics > 0
        tmp = post_query(:post, args.merge(limit: expected_topics * 3)).to_a

        topic_ids = Set.new db_result.map{|r| r["id"]}

        tmp.reject! do |i|
          if topic_ids.include?(i["id"])
            true
          else
            topic_ids << i["id"]
            false
          end
        end

        db_result += tmp[0..expected_topics-1]
      end

      group_db_result(db_result)
    end


    # If we're searching for a single topic
    def single_topic(id)
      topic = Topic.where(id: id).first
      return nil unless @guardian.can_see?(topic)

      group_db_result([{'type' => 'topic',
                        'id' => topic.id,
                        'url' => topic.relative_url,
                        'title' => topic.title }])
    end

    def add_allowed_categories(builder)
      allowed_categories = nil
      allowed_categories = @guardian.secure_category_ids
      if allowed_categories.present?
        builder.where("(c.id IS NULL OR c.secure OR c.id in (:category_ids))", category_ids: allowed_categories)
      else
        builder.where("(c.id IS NULL OR (NOT c.secure))")
      end
    end


    def category_query(args)
      builder = SqlBuilder.new <<SQL
    SELECT 'category' AS type,
            c.name AS id,
            '/category/' || c.slug AS url,
            c.name AS title,
            NULL AS email,
            c.color,
            c.text_color
    FROM categories AS c
    JOIN category_search_data s on s.category_id = c.id
    /*where*/
    ORDER BY topics_month desc
    LIMIT :limit
SQL

      builder.where "s.search_data @@ TO_TSQUERY(:locale, :query)"
      add_allowed_categories(builder)

      builder.exec(args)
    end

    def user_query(args)
      sql = "SELECT 'user' AS type,
                    u.username_lower AS id,
                    '/users/' || u.username_lower AS url,
                    u.username AS title,
                    u.email,
                    NULL AS color,
                    NULL AS text_color
            FROM users AS u
            JOIN user_search_data s on s.user_id = u.id
            WHERE s.search_data @@ TO_TSQUERY(:locale, :query)
            ORDER BY CASE WHEN u.username_lower = lower(:orig) then 0 else 1 end,  last_posted_at desc
            LIMIT :limit"
      ActiveRecord::Base.exec_sql(sql, args)
    end

    def post_query(type, args)
      builder = SqlBuilder.new <<SQL
      /*select*/
      FROM topics AS ft
      /*join*/
        JOIN post_search_data s on s.post_id = p.id
        LEFT JOIN categories c ON c.id = ft.category_id
      /*where*/
      ORDER BY
              TS_RANK_CD(TO_TSVECTOR(:locale, ft.title), TO_TSQUERY(:locale, :query)) desc,
              TS_RANK_CD(search_data, TO_TSQUERY(:locale, :query)) desc,
              bumped_at desc
      LIMIT :limit
SQL

      builder.select "'topic' AS type"
      builder.select("CAST(ft.id AS VARCHAR)")

      if type == :topic
        builder.select "'/t/slug/' || ft.id AS url"
      else
        builder.select "'/t/slug/' || ft.id || '/' || p.post_number AS url"
      end

      builder.select "ft.title, NULL AS email, NULL AS color, NULL AS text_color"

      if type == :topic
        builder.join "posts AS p ON p.topic_id = ft.id AND p.post_number = 1"
      else
        builder.join "posts AS p ON p.topic_id = ft.id AND p.post_number > 1"
      end

      builder.where <<SQL
  s.search_data @@ TO_TSQUERY(:locale, :query)
        AND ft.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND ft.visible
        AND ft.archetype <> '#{Archetype.private_message}'
SQL

      add_allowed_categories(builder)

      builder.exec(args)
    end

    # Group the results by type
    def group_db_result(db_result)
      grouped = {}
      db_result.each do |row|
        type = row.delete('type')

        # Add the slug for topics
        if type == 'topic'
          new_slug = Slug.for(row['title'])
          new_slug = "topic" if new_slug.blank?
          row['url'].gsub!('slug', new_slug)
        elsif type == 'user'
          row['avatar_template'] = User.avatar_template(row['email'])
        end

        # Remove attributes when we know they don't matter
        row.delete('email')
        unless type == 'category'
          row.delete('color')
          row.delete('text_color')
        end

        grouped[type] = (grouped[type] || []) << row
      end

      grouped.map do |type, results|
        more = @opts[:type_filter].blank? && (results.size > Search.per_facet)
        results = results[0..([results.length, Search.per_facet].min - 1)] if @opts[:type_filter].blank?
        {
          type: type,
          name: I18n.t("search.types.#{type}"),
          more: more,
          results: results
        }
      end
    end

end
