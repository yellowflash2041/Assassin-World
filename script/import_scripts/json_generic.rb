require "csv"
require File.expand_path(File.dirname(__FILE__) + "/base.rb")

# Edit the constants and initialize method for your import data.

class ImportScripts::JsonGeneric < ImportScripts::Base

  JSON_FILE_PATH = ENV['JSON_FILE']
  BATCH_SIZE  ||= 1000

  def initialize
    super

    @imported_json = load_json
  end

  def execute
    puts "", "Importing from JSON file..."

    import_users
    import_discussions

    puts "", "Done"
  end

  def load_json
    JSON.parse(File.read(JSON_FILE_PATH))
  end

  def import_users
    puts '', "Importing users"

    users = []
    @imported_json['topics'].each do |t|
      t['posts'].each do |p|
        users << p['author']
      end
    end
    users.uniq!

    create_users(users) do |u|
      {
        id: u,
        email: "#{u}@example.com",
        created_at: Time.now
      }
    end
  end


  def import_discussions
    puts "", "Importing discussions"

    topics = 0
    posts = 0

    @imported_json['topics'].each do |t|
      first_post = t['posts'][0]
      next unless first_post

      topic = {
        id: t["id"],
        user_id: user_id_from_imported_user_id(first_post["author"]) || -1,
        raw: first_post["body"],
        created_at: Time.zone.parse(first_post["date"]),
        cook_method: Post.cook_methods[:raw_html],
        title: t['title'],
        category: ENV['CATEGORY_ID'],
        custom_fields: { import_id: "pid:#{first_post['id']}" }
      }

      topic[:pinned_at] = Time.zone.parse(first_post["date"]) if t['pinned']
      topics += 1
      parent_post = create_post(topic, topic[:id])

      t['posts'][1..-1].each do |p|
        create_post({
          id: p["id"],
          topic_id: parent_post.topic_id,
          user_id: user_id_from_imported_user_id(p["author"]) || -1,
          raw: p["body"],
          created_at: Time.zone.parse(p["date"]),
          cook_method: Post.cook_methods[:raw_html],
          custom_fields: { import_id: "pid:#{p['id']}" }
        }, p['id'])
        posts += 1
      end
    end

    puts "", "Imported #{topics} topics with #{topics + posts} posts."
  end
end

if __FILE__==$0
  ImportScripts::JsonGeneric.new.perform
end
