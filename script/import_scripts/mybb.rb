require File.expand_path(File.dirname(__FILE__) + "/base.rb")

require "mysql2"

# Call it like this:
#   RAILS_ENV=production bundle exec ruby script/import_scripts/mybb.rb
class ImportScripts::MyBB < ImportScripts::Base

  MYBB_DB = "mybb_db"
  BATCH_SIZE = 1000

  def initialize
    super

    @client = Mysql2::Client.new(
      host: "localhost",
      username: "root",
      #password: "",
      database: MYBB_DB
    )
  end

  def execute
    import_users
    import_categories
    import_posts
    import_private_messages
    suspend_users
  end

  def import_users
    puts '', "creating users"

    total_count = mysql_query("SELECT count(*) count
                                 FROM mybb_users u
                                 JOIN mybb_usergroups g ON g.gid = u.usergroup
                                WHERE g.title != 'Banned';").first['count']

    batches(BATCH_SIZE) do |offset|
      results = mysql_query(
        "SELECT uid id, email email, username, regdate, g.title `group`
           FROM mybb_users u
           JOIN mybb_usergroups g ON g.gid = u.usergroup
          WHERE g.title != 'Banned'
          ORDER BY u.uid ASC
          LIMIT #{BATCH_SIZE}
         OFFSET #{offset};")

      break if results.size < 1

      create_users(results, total: total_count, offset: offset) do |user|
        { id: user['id'],
          email: user['email'],
          username: user['username'],
          created_at: Time.zone.at(user['regdate']),
          moderator: user['group'] == 'Super Moderators',
          admin: user['group'] == 'Administrators' }
      end
    end
  end

  def import_categories
    results = mysql_query("
      SELECT fid id, pid parent_id, left(name, 50) name, description
        FROM mybb_forums
    ORDER BY pid ASC, fid ASC
    ")

    create_categories(results) do |row|
      h = {id: row['id'], name: CGI.unescapeHTML(row['name']), description: CGI.unescapeHTML(row['description'])}
      if row['parent_id'].to_i > 0
        parent = category_from_imported_category_id(row['parent_id'])
        h[:parent_category_id] = parent.id if parent
      end
      h
    end
  end

  def import_posts
    puts "", "creating topics and posts"

    total_count = mysql_query("SELECT count(*) count from mybb_posts").first["count"]

    batches(BATCH_SIZE) do |offset|
      results = mysql_query("
        SELECT p.pid id,
               p.tid topic_id,
               t.fid category_id,
               t.subject title,
               t.firstpost first_post_id,
               p.uid user_id,
               p.message raw,
               p.dateline post_time
          FROM mybb_posts p,
               mybb_threads t
         WHERE p.tid = t.tid
      ORDER BY id
         LIMIT #{BATCH_SIZE}
        OFFSET #{offset};
      ")

      break if results.size < 1

      create_posts(results, total: total_count, offset: offset) do |m|
        skip = false
        mapped = {}

        mapped[:id] = m['id']
        mapped[:user_id] = user_id_from_imported_user_id(m['user_id']) || -1
        mapped[:raw] = process_mybb_post(m['raw'], m['id'])
        mapped[:created_at] = Time.zone.at(m['post_time'])

        if m['id'] == m['first_post_id']
          mapped[:category] = category_from_imported_category_id(m['category_id']).try(:name)
          mapped[:title] = CGI.unescapeHTML(m['title'])
        else
          parent = topic_lookup_from_imported_post_id(m['first_post_id'])
          if parent
            mapped[:topic_id] = parent[:topic_id]
          else
            puts "Parent post #{m['first_post_id']} doesn't exist. Skipping #{m["id"]}: #{m["title"][0..40]}"
            skip = true
          end
        end

        skip ? nil : mapped
      end
    end
  end

  def import_private_messages
    puts "", "private messages are not implemented"
  end

  def suspend_users
    puts '', "banned users are not implemented"
  end

  def process_mybb_post(raw, import_id)
    s = raw.dup

    # :) is encoded as <!-- s:) --><img src="{SMILIES_PATH}/icon_e_smile.gif" alt=":)" title="Smile" /><!-- s:) -->
    s.gsub!(/<!-- s(\S+) -->(?:.*)<!-- s(?:\S+) -->/, '\1')

    # Some links look like this: <!-- m --><a class="postlink" href="http://www.onegameamonth.com">http://www.onegameamonth.com</a><!-- m -->
    s.gsub!(/<!-- \w --><a(?:.+)href="(\S+)"(?:.*)>(.+)<\/a><!-- \w -->/, '[\2](\1)')

    # Many phpbb bbcode tags have a hash attached to them. Examples:
    #   [url=https&#58;//google&#46;com:1qh1i7ky]click here[/url:1qh1i7ky]
    #   [quote=&quot;cybereality&quot;:b0wtlzex]Some text.[/quote:b0wtlzex]
    s.gsub!(/:(?:\w{8})\]/, ']')

    s = CGI.unescapeHTML(s)

    # phpBB shortens link text like this, which breaks our markdown processing:
    #   [http://answers.yahoo.com/question/index ... 223AAkkPli](http://answers.yahoo.com/question/index?qid=20070920134223AAkkPli)
    #
    # Work around it for now:
    s.gsub!(/\[http(s)?:\/\/(www\.)?/, '[')

    s
  end

  def mysql_query(sql)
    @client.query(sql, cache_rows: false)
  end
end

ImportScripts::MyBB.new.perform
