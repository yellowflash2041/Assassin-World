require "pg"
require "set"
require "redcarpet"

puts "Loading application..."
require_relative "../../config/environment"

module BulkImport; end

class BulkImport::Base

  NOW ||= "now()".freeze
  PRIVATE_OFFSET ||= 2 ** 30

  def initialize
    db = ActiveRecord::Base.connection_config
    @encoder = PG::TextEncoder::CopyRow.new
    @raw_connection = PG.connect(dbname: db[:database], host: db[:host_names]&.first, port: db[:port])

    @markdown = Redcarpet::Markdown.new(
      Redcarpet::Render::HTML,
      fenced_code_blocks: true,
      autolink: true
    )
  end

  def run
    puts "Starting..."
    preload_i18n
    fix_highest_post_numbers
    load_imported_ids
    load_indexes
    execute
    fix_primary_keys
    puts "Done!"
  end

  def preload_i18n
    puts "Preloading I18n..."
    I18n.locale = ENV.fetch("LOCALE") { "en" }.to_sym
    I18n.t("test")
    ActiveSupport::Inflector.transliterate("test")
  end

  def fix_highest_post_numbers
    puts "Fixing highest post numbers..."
    @raw_connection.exec <<-SQL
      WITH X AS (
          SELECT topic_id
               , COALESCE(MAX(post_number), 0) max_post_number
            FROM posts
           WHERE deleted_at IS NULL
        GROUP BY topic_id
      )
      UPDATE topics
         SET highest_post_number = X.max_post_number
        FROM X
       WHERE id = X.topic_id
         AND highest_post_number <> X.max_post_number
    SQL
  end

  def load_imported_ids
    puts "Loading imported group ids..."
    @groups = GroupCustomField.where(name: "import_id").pluck(:value, :group_id).to_h
    @last_imported_group_id = @groups.keys.map(&:to_i).max || -1

    puts "Loading imported user ids..."
    @users = UserCustomField.where(name: "import_id").pluck(:value, :user_id).to_h
    @last_imported_user_id = @users.keys.map(&:to_i).max || -1

    puts "Loading imported category ids..."
    @categories = CategoryCustomField.where(name: "import_id").pluck(:value, :category_id).to_h
    @last_imported_category_id = @categories.keys.map(&:to_i).max || -1

    puts "Loading imported topic ids..."
    @topics = TopicCustomField.where(name: "import_id").pluck(:value, :topic_id).to_h
    imported_topic_ids = @topics.keys.map(&:to_i)
    @last_imported_topic_id = imported_topic_ids.select { |id| id < PRIVATE_OFFSET }.max || -1
    @last_imported_private_topic_id = imported_topic_ids.select { |id| id > PRIVATE_OFFSET }.max || (PRIVATE_OFFSET - 1)

    puts "Loading imported post ids..."
    @posts = PostCustomField.where(name: "import_id").pluck(:value, :post_id).to_h
    imported_post_ids = @posts.keys.map(&:to_i)
    @last_imported_post_id = imported_post_ids.select { |id| id < PRIVATE_OFFSET }.max || -1
    @last_imported_private_post_id = imported_post_ids.select { |id| id > PRIVATE_OFFSET }.max || (PRIVATE_OFFSET - 1)
  end

  def load_indexes
    puts "Loading groups indexes..."
    @last_group_id = Group.unscoped.maximum(:id)
    @group_names = Group.unscoped.pluck(:name).map(&:downcase).to_set

    puts "Loading users indexes..."
    @last_user_id = User.unscoped.maximum(:id)
    @emails = User.unscoped.pluck(:email).to_set
    @usernames_lower = User.unscoped.pluck(:username_lower).to_set
    @mapped_usernames = UserCustomField.joins(:user).where(name: "import_username").pluck("user_custom_fields.value", "users.username").to_h

    puts "Loading categories indexes..."
    @last_category_id = Category.unscoped.maximum(:id)
    @category_names = Category.unscoped.pluck(:parent_category_id, :name).map { |pci, name| "#{pci}-#{name}" }.to_set

    puts "Loading topics indexes..."
    @last_topic_id = Topic.unscoped.maximum(:id)
    @highest_post_number_by_topic_id = Topic.unscoped.pluck(:id, :highest_post_number).to_h

    puts "Loading posts indexes..."
    @last_post_id = Post.unscoped.maximum(:id)
    @post_number_by_post_id = Post.unscoped.pluck(:id, :post_number).to_h
    @topic_id_by_post_id = Post.unscoped.pluck(:id, :topic_id).to_h
  end

  def execute
    raise NotImplementedError
  end

  def fix_primary_keys
    puts "Updating primary key sequences..."
    @raw_connection.exec("SELECT setval('#{Group.sequence_name}', #{@last_group_id})")
    @raw_connection.exec("SELECT setval('#{User.sequence_name}', #{@last_user_id})")
    @raw_connection.exec("SELECT setval('#{Category.sequence_name}', #{@last_category_id})")
    @raw_connection.exec("SELECT setval('#{Topic.sequence_name}', #{@last_topic_id})")
    @raw_connection.exec("SELECT setval('#{Post.sequence_name}', #{@last_post_id})")
  end

  def group_id_from_imported_id(id); @groups[id.to_s]; end
  def user_id_from_imported_id(id); @users[id.to_s]; end
  def category_id_from_imported_id(id); @categories[id.to_s]; end
  def topic_id_from_imported_id(id); @topics[id.to_s]; end
  def post_id_from_imported_id(id); @posts[id.to_s]; end

  def post_number_from_imported_id(id); @post_number_by_post_id[post_id_from_imported_id(id)]; end
  def topic_id_from_imported_post_id(id); @topic_id_by_post_id[post_id_from_imported_id(id)]; end

  GROUP_COLUMNS ||= %i{
    id name title bio_raw bio_cooked created_at updated_at
  }

  USER_COLUMNS ||= %i{
    id username username_lower name email active trust_level admin moderator
    date_of_birth ip_address registration_ip_address primary_group_id
    suspended_at suspended_till last_emailed_at created_at updated_at
  }

  USER_PROFILE_COLUMNS ||= %i{
    user_id location website bio_raw bio_cooked views
  }

  GROUP_USER_COLUMNS ||= %i{
    group_id user_id created_at updated_at
  }

  CATEGORY_COLUMNS ||= %i{
    id name name_lower slug user_id description position parent_category_id
    created_at updated_at
  }

  TOPIC_COLUMNS ||= %i{
    id archetype title fancy_title slug user_id last_post_user_id category_id
    visible closed pinned_at views created_at bumped_at updated_at
  }

  POST_COLUMNS ||= %i{
    id user_id last_editor_id topic_id post_number sort_order reply_to_post_number
    raw cooked hidden word_count created_at last_version_at updated_at
  }

  TOPIC_ALLOWED_USER_COLUMNS ||= %i{
    topic_id user_id created_at updated_at
  }

  def create_groups(rows, &block); create_records(rows, "group", GROUP_COLUMNS, &block); end

  def create_users(rows, &block)
    @imported_usernames = {}

    create_records(rows, "user", USER_COLUMNS, &block)

    create_custom_fields("user", "username", @imported_usernames.keys) do |username|
      {
        record_id: @imported_usernames[username],
        value: username,
      }
    end
  end

  def create_user_profiles(rows, &block); create_records(rows, "user_profile", USER_PROFILE_COLUMNS, &block); end
  def create_group_users(rows, &block); create_records(rows, "group_user", GROUP_USER_COLUMNS, &block); end
  def create_categories(rows, &block); create_records(rows, "category", CATEGORY_COLUMNS, &block); end
  def create_topics(rows, &block); create_records(rows, "topic", TOPIC_COLUMNS, &block); end
  def create_posts(rows, &block); create_records(rows, "post", POST_COLUMNS, &block); end
  def create_topic_allowed_users(rows, &block); create_records(rows, "topic_allowed_user", TOPIC_ALLOWED_USER_COLUMNS, &block); end

  def process_group(group)
    @groups[group[:imported_id].to_s] = group[:id] = @last_group_id += 1

    group[:name] = fix_name(group[:name])

    unless @group_names.add?(group[:name].downcase)
      group_name = group[:name] + "_1"
      group_name.next! until @group_names.add?(group_name.downcase)
      group[:name] = group_name
    end

    group[:title]      = group[:title].scrub.strip.presence
    group[:bio_raw]    = group[:bio_raw].scrub.strip.presence
    group[:bio_cooked] = pre_cook(group[:bio_raw]) if group[:bio_raw].present?
    group[:created_at] ||= NOW
    group[:updated_at] ||= group[:created_at]
    group
  end

  def process_user(user)
    @users[user[:imported_id].to_s] = user[:id] = @last_user_id += 1

    imported_username = user[:username].dup

    user[:username] = fix_name(user[:username]).presence || random_username

    if user[:username] != imported_username
      @imported_usernames[imported_username] = user[:id]
      @mapped_usernames[imported_username] = user[:username]
    end

    # unique username_lower
    unless @usernames_lower.add?(user[:username].downcase)
      username = user[:username] + "_1"
      username.next! until @usernames_lower.add?(username.downcase)
      user[:username] = username
    end

    user[:username_lower] = user[:username].downcase
    user[:email] ||= random_email
    user[:email].downcase!

    # unique email
    user[:email] = random_email until user[:email] =~ EmailValidator.email_regex && @emails.add?(user[:email])
    user[:trust_level] ||= TrustLevel[1]
    user[:active] = true unless user.has_key?(:active)
    user[:admin] ||= false
    user[:moderator] ||= false
    user[:last_emailed_at] ||= NOW
    user[:created_at] ||= NOW
    user[:updated_at] ||= user[:created_at]
    user
  end

  def process_user_profile(user_profile)
    user_profile[:bio_raw]    = (user_profile[:bio_raw].presence || "").scrub.strip.presence
    user_profile[:bio_cooked] = pre_cook(user_profile[:bio_raw]) if user_profile[:bio_raw].present?
    user_profile
  end

  def process_group_user(group_user)
    group_user[:created_at] = NOW
    group_user[:updated_at] = NOW
    group_user
  end

  def process_category(category)
    @categories[category[:imported_id].to_s] = category[:id] = @last_category_id += 1
    category[:name] = category[:name][0...50].scrub.strip
    # TODO: unique name
    category[:name_lower] = category[:name].downcase
    category[:slug] ||= Slug.ascii_generator(category[:name_lower])
    category[:description] = (category[:description] || "").scrub.strip.presence
    category[:user_id] ||= Discourse::SYSTEM_USER_ID
    category[:created_at] ||= NOW
    category[:updated_at] ||= category[:created_at]
    category
  end

  def process_topic(topic)
    @topics[topic[:imported_id].to_s] = topic[:id] = @last_topic_id += 1
    topic[:archetype] ||= Archetype.default
    topic[:title] = topic[:title][0...255].scrub.strip
    topic[:fancy_title] ||= pre_fancy(topic[:title])
    topic[:slug] ||= Slug.ascii_generator(topic[:title])
    topic[:user_id] ||= Discourse::SYSTEM_USER_ID
    topic[:last_post_user_id] ||= topic[:user_id]
    topic[:category_id] ||= -1 if topic[:archetype] != Archetype.private_message
    topic[:visible] = true unless topic.has_key?(:visible)
    topic[:closed] ||= false
    topic[:views] ||= 0
    topic[:created_at] ||= NOW
    topic[:bumped_at]  ||= topic[:created_at]
    topic[:updated_at] ||= topic[:created_at]
    topic
  end

  def process_post(post)
    @posts[post[:imported_id].to_s] = post[:id] = @last_post_id += 1
    post[:user_id] ||= Discourse::SYSTEM_USER_ID
    post[:last_editor_id] = post[:user_id]
    @highest_post_number_by_topic_id[post[:topic_id]] ||= 0
    post[:post_number] = @highest_post_number_by_topic_id[post[:topic_id]] += 1
    post[:sort_order] = post[:post_number]
    @post_number_by_post_id[post[:id]] = post[:post_number]
    @topic_id_by_post_id[post[:id]] = post[:topic_id]
    post[:raw] = (post[:raw] || "").scrub.strip.presence || "<Empty imported post>"
    post[:raw] = process_raw post[:raw]
    post[:cooked] = pre_cook post[:raw]
    post[:hidden] ||= false
    post[:word_count] = post[:raw].scan(/[[:word:]]+/).size
    post[:created_at] ||= NOW
    post[:last_version_at] = post[:created_at]
    post[:updated_at] ||= post[:created_at]
    post
  end

  def process_topic_allowed_user(topic_allowed_user)
    topic_allowed_user[:created_at] = NOW
    topic_allowed_user[:updated_at] = NOW
    topic_allowed_user
  end

  def process_raw(raw)
    # fix whitespaces
    raw.gsub!(/(\\r)?\\n/, "\n")
    raw.gsub!("\\t", "\t")

    # [HTML]...[/HTML]
    raw.gsub!(/\[HTML\]/i, "\n\n```html\n")
    raw.gsub!(/\[\/HTML\]/i, "\n```\n\n")

    # [PHP]...[/PHP]
    raw.gsub!(/\[PHP\]/i, "\n\n```php\n")
    raw.gsub!(/\[\/PHP\]/i, "\n```\n\n")

    # [HIGHLIGHT="..."]
    raw.gsub!(/\[HIGHLIGHT="?(\w+)"?\]/i) { "\n\n```#{$1.downcase}\n" }

    # [CODE]...[/CODE]
    # [HIGHLIGHT]...[/HIGHLIGHT]
    raw.gsub!(/\[\/?CODE\]/i, "\n\n```\n\n")
    raw.gsub!(/\[\/?HIGHLIGHT\]/i, "\n\n```\n\n")

    # [SAMP]...[/SAMP]
    raw.gsub!(/\[\/?SAMP\]/i, "`")

    # replace all chevrons with HTML entities
    # /!\ must be done /!\
    #  - AFTER the "code" processing
    #  - BEFORE the "quote" processing
    raw.gsub!(/`([^`]+?)`/im) { "`" + $1.gsub("<", "\u2603") + "`" }
    raw.gsub!("<", "&lt;")
    raw.gsub!("\u2603", "<")

    raw.gsub!(/`([^`]+?)`/im) { "`" + $1.gsub(">", "\u2603") + "`" }
    raw.gsub!(">", "&gt;")
    raw.gsub!("\u2603", ">")

    raw.gsub!(/\[\/?I\]/i, "*")
    raw.gsub!(/\[\/?B\]/i, "**")
    raw.gsub!(/\[\/?U\]/i, "")

    raw.gsub!(/\[\/?RED\]/i, "")
    raw.gsub!(/\[\/?BLUE\]/i, "")

    raw.gsub!(/\[AUTEUR\].+?\[\/AUTEUR\]/im, "")
    raw.gsub!(/\[VOIRMSG\].+?\[\/VOIRMSG\]/im, "")
    raw.gsub!(/\[PSEUDOID\].+?\[\/PSEUDOID\]/im, "")

    # [IMG]...[/IMG]
    raw.gsub!(/(?:\s*\[IMG\]\s*)+(.+?)(?:\s*\[\/IMG\]\s*)+/im) { "\n\n#{$1}\n\n" }

    # [URL=...]...[/URL]
    raw.gsub!(/\[URL="?(.+?)"?\](.+?)\[\/URL\]/im) { "[#{$2.strip}](#{$1})" }

    # [URL]...[/URL]
    # [MP3]...[/MP3]
    raw.gsub!(/\[\/?URL\]/i, "")
    raw.gsub!(/\[\/?MP3\]/i, "")

    # [FONT=blah] and [COLOR=blah]
    raw.gsub!(/\[FONT=.*?\](.*?)\[\/FONT\]/im, "\\1")
    raw.gsub!(/\[COLOR=.*?\](.*?)\[\/COLOR\]/im, "\\1")

    raw.gsub!(/\[SIZE=.*?\](.*?)\[\/SIZE\]/im, "\\1")
    raw.gsub!(/\[H=.*?\](.*?)\[\/H\]/im, "\\1")

    # [CENTER]...[/CENTER]
    raw.gsub!(/\[CENTER\](.*?)\[\/CENTER\]/im, "\\1")

    # [INDENT]...[/INDENT]
    raw.gsub!(/\[INDENT\](.*?)\[\/INDENT\]/im, "\\1")
    raw.gsub!(/\[TABLE\](.*?)\[\/TABLE\]/im, "\\1")
    raw.gsub!(/\[TR\](.*?)\[\/TR\]/im, "\\1")
    raw.gsub!(/\[TD\](.*?)\[\/TD\]/im, "\\1")
    raw.gsub!(/\[TD="?.*?"?\](.*?)\[\/TD\]/im, "\\1")

    # [QUOTE]...[/QUOTE]
    raw.gsub!(/\[QUOTE\](.+?)\[\/QUOTE\]/im) { |quote|
      quote.gsub!(/\[QUOTE\](.+?)\[\/QUOTE\]/im) { "\n#{$1}\n" }
      quote.gsub!(/\n(.+?)/) { "\n> #{$1}" }
    }

    # [QUOTE=<username>;<postid>]...[/QUOTE]
    raw.gsub!(/\[QUOTE=([^;]+);(\d+)\](.+?)\[\/QUOTE\]/im) do
      imported_username, imported_postid, quote = $1, $2, $3

      username = @mapped_usernames[imported_username] || imported_username
      post_id = post_id_from_imported_id(imported_postid)
      post_number = @post_number_by_post_id[post_id]
      topic_id = @topic_id_by_post_id[post_id]

      if post_number && topic_id
        "\n[quote=\"#{username}, post:#{post_number}, topic:#{topic_id}\"]\n#{quote}\n[/quote]"
      else
        "\n[quote=\"#{username}\"]\n#{quote}\n[/quote]\n"
      end
    end

    # [YOUTUBE]<id>[/YOUTUBE]
    raw.gsub!(/\[YOUTUBE\](.+?)\[\/YOUTUBE\]/i) { "\nhttps://www.youtube.com/watch?v=#{$1}\n" }
    raw.gsub!(/\[DAILYMOTION\](.+?)\[\/DAILYMOTION\]/i) { "\nhttps://www.dailymotion.com/video/#{$1}\n" }

    # [VIDEO=youtube;<id>]...[/VIDEO]
    raw.gsub!(/\[VIDEO=YOUTUBE;([^\]]+)\].*?\[\/VIDEO\]/i) { "\nhttps://www.youtube.com/watch?v=#{$1}\n" }
    raw.gsub!(/\[VIDEO=DAILYMOTION;([^\]]+)\].*?\[\/VIDEO\]/i) { "\nhttps://www.dailymotion.com/video/#{$1}\n" }

    # [SPOILER=Some hidden stuff]SPOILER HERE!![/SPOILER]
    raw.gsub!(/\[SPOILER="?(.+?)"?\](.+?)\[\/SPOILER\]/im) { "\n#{$1}\n[spoiler]#{$2}[/spoiler]\n" }

    raw
  end

  def create_records(rows, name, columns)
    start = Time.now

    imported_ids = []
    process_method_name = "process_#{name}"
    sql = "COPY #{name.pluralize} (#{columns.join(",")}) FROM STDIN"

    @raw_connection.copy_data(sql, @encoder) do
      rows.each do |row|
        mapped = yield(row)
        next unless mapped
        processed = send(process_method_name, mapped)
        imported_ids << mapped[:imported_id]
        @raw_connection.put_copy_data columns.map { |c| processed[c] }
        print "\r%7d - %6d/sec".freeze % [imported_ids.size, imported_ids.size.to_f / (Time.now - start)] if imported_ids.size % 5000 == 0
      end
    end

    if imported_ids.size > 0
      print "\r%7d - %6d/sec".freeze % [imported_ids.size, imported_ids.size.to_f / (Time.now - start)]
      puts
    end

    id_mapping_method_name = "#{name}_id_from_imported_id".freeze
    return unless respond_to?(id_mapping_method_name)
    create_custom_fields(name, "id", imported_ids) do |imported_id|
      {
        record_id: send(id_mapping_method_name, imported_id),
        value: imported_id,
      }
    end
  end

  def create_custom_fields(table, name, rows)
    name = "import_#{name}"
    sql = "COPY #{table}_custom_fields (#{table}_id, name, value, created_at, updated_at) FROM STDIN"
    @raw_connection.copy_data(sql, @encoder) do
      rows.each do |row|
        cf = yield row
        next unless cf
        @raw_connection.put_copy_data [cf[:record_id], name, cf[:value], NOW, NOW]
      end
    end
  end

  def fix_name(name)
    return if name.blank?
    name.scrub!
    name = ActiveSupport::Inflector.transliterate(name)
    name.gsub!(/[^\w.-]+/, "_")
    name.gsub!(/^\W+/, "")
    name.gsub!(/[^A-Za-z0-9]+$/, "")
    name.gsub!(/([-_.]{2,})/) { $1.first }
    name.strip!
    name
  end

  def random_username
    "Anonymous_#{SecureRandom.hex}"
  end

  def random_email
    "#{SecureRandom.hex}@ema.il"
  end

  def pre_cook(raw)
    cooked = @markdown.render(raw).scrub.strip

    cooked.gsub!(/\[QUOTE="?([^,"]+)(?:, post:(\d+), topic:(\d+))?"?\](.+?)\[\/QUOTE\]/im) do
      username, post_id, topic_id = $1, $2, $3
      quote = @markdown.render($4.presence || "").scrub.strip

      if post_id.present? && topic_id.present?
        <<-HTML
          <aside class="quote" data-post="#{post_id}" data-topic="#{topic_id}">
            <div class="title">#{username}:</div>
            <blockquote>#{quote}</blockquote>
          </aside>
        HTML
      else
        <<-HTML
          <aside class="quote">
            <div class="title">#{username}:</div>
            <blockquote>#{quote}</blockquote>
          </aside>
        HTML
      end
    end

    cooked.scrub.strip
  end

  def pre_fancy(title)
    Redcarpet::Render::SmartyPants.render(ERB::Util.html_escape(title)).scrub.strip
  end

end
