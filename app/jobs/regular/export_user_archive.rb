# frozen_string_literal: true

require 'csv'

module Jobs
  class ExportUserArchive < ::Jobs::Base
    sidekiq_options retry: false

    attr_accessor :current_user
    # note: contents provided entirely by user
    attr_accessor :extra

    COMPONENTS ||= %w(
      user_archive
      user_archive_profile
    )

    HEADER_ATTRS_FOR ||= HashWithIndifferentAccess.new(
      user_archive: ['topic_title', 'categories', 'is_pm', 'post', 'like_count', 'reply_count', 'url', 'created_at'],
      user_archive_profile: ['location', 'website', 'bio', 'views'],
    )

    def execute(args)
      @current_user = User.find_by(id: args[:user_id])
      @extra = HashWithIndifferentAccess.new(args[:args]) if args[:args]
      @timestamp ||= Time.now.strftime("%y%m%d-%H%M%S")

      components = []

      COMPONENTS.each do |name|
        h = { name: name, method: :"#{name}_export" }
        h[:filetype] = :csv
        filename_method = :"#{name}_filename"
        if respond_to? filename_method
          h[:filename] = public_send(filename_method)
        else
          h[:filename] = "#{name}-#{@current_user.username}-#{@timestamp}"
        end
        components.push(h)
      end

      export_title = 'user_archive'.titleize
      filename = components.first[:filename]
      user_export = UserExport.create(file_name: filename, user_id: @current_user.id)

      filename = "#{filename}-#{user_export.id}"
      dirname = "#{UserExport.base_directory}/#{filename}"

      # ensure directory exists
      FileUtils.mkdir_p(dirname) unless Dir.exists?(dirname)

      # Generate a compressed CSV file
      zip_filename = nil
      begin
        components.each do |component|
          case component[:filetype]
          when :csv
            CSV.open("#{dirname}/#{component[:filename]}.csv", "w") do |csv|
              csv << get_header(component[:name])
              public_send(component[:method]).each { |d| csv << d }
            end
          else
            raise 'unknown export filetype'
          end
        end

        zip_filename = Compression::Zip.new.compress(UserExport.base_directory, filename)
      ensure
        FileUtils.rm_rf(dirname)
      end

      # create upload
      upload = nil

      if File.exist?(zip_filename)
        File.open(zip_filename) do |file|
          upload = UploadCreator.new(
            file,
            File.basename(zip_filename),
            type: 'csv_export',
            for_export: 'true'
          ).create_for(@current_user.id)

          if upload.persisted?
            user_export.update_columns(upload_id: upload.id)
          else
            Rails.logger.warn("Failed to upload the file #{zip_filename}")
          end
        end

        File.delete(zip_filename)
      end
    ensure
      post = notify_user(upload, export_title)

      if user_export.present? && post.present?
        topic = post.topic
        user_export.update_columns(topic_id: topic.id)
        topic.update_status('closed', true, Discourse.system_user)
      end
    end

    def user_archive_export
      return enum_for(:user_archive_export) unless block_given?

      Post.includes(topic: :category)
        .where(user_id: @current_user.id)
        .select(:topic_id, :post_number, :raw, :like_count, :reply_count, :created_at)
        .order(:created_at)
        .with_deleted
        .each do |user_archive|
        yield get_user_archive_fields(user_archive)
      end
    end

    def user_archive_profile_export
      return enum_for(:user_archive_profile_export) unless block_given?

      UserProfile
        .where(user_id: @current_user.id)
        .select(:location, :website, :bio_raw, :views)
        .each do |user_profile|
        yield get_user_archive_profile_fields(user_profile)
      end
    end

    def get_header(entity)
      if entity == 'user_list'
        header_array = HEADER_ATTRS_FOR['user_list'] + HEADER_ATTRS_FOR['user_stats'] + HEADER_ATTRS_FOR['user_profile']
        header_array.concat(HEADER_ATTRS_FOR['user_sso']) if SiteSetting.enable_sso
        user_custom_fields = UserField.all
        if user_custom_fields.present?
          user_custom_fields.each do |custom_field|
            header_array.push("#{custom_field.name} (custom user field)")
          end
        end
        header_array.push("group_names")
      else
        header_array = HEADER_ATTRS_FOR[entity]
      end

      header_array
    end

    private

    def get_user_archive_fields(user_archive)
      user_archive_array = []
      topic_data = user_archive.topic
      user_archive = user_archive.as_json
      topic_data = Topic.with_deleted.find_by(id: user_archive['topic_id']) if topic_data.nil?
      return user_archive_array if topic_data.nil?

      all_categories = Category.all.to_h { |category| [category.id, category] }

      categories = "-"
      if topic_data.category_id && category = all_categories[topic_data.category_id]
        categories = [category.name]
        while category.parent_category_id && category = all_categories[category.parent_category_id]
          categories << category.name
        end
        categories = categories.reverse.join("|")
      end

      is_pm = topic_data.archetype == "private_message" ? I18n.t("csv_export.boolean_yes") : I18n.t("csv_export.boolean_no")
      url = "#{Discourse.base_url}/t/#{topic_data.slug}/#{topic_data.id}/#{user_archive['post_number']}"

      topic_hash = { "post" => user_archive['raw'], "topic_title" => topic_data.title, "categories" => categories, "is_pm" => is_pm, "url" => url }
      user_archive.merge!(topic_hash)

      HEADER_ATTRS_FOR['user_archive'].each do |attr|
        user_archive_array.push(user_archive[attr])
      end

      user_archive_array
    end

    def get_user_archive_profile_fields(user_profile)
      user_archive_profile = []

      HEADER_ATTRS_FOR['user_archive_profile'].each do |attr|
        data =
          if attr == 'bio'
            user_profile.attributes['bio_raw']
          else
            user_profile.attributes[attr]
          end

          user_archive_profile.push(data)
      end

      user_archive_profile
    end

    def notify_user(upload, export_title)
      post = nil

      if @current_user
        post = if upload
          SystemMessage.create_from_system_user(
            @current_user,
            :csv_export_succeeded,
            download_link: UploadMarkdown.new(upload).attachment_markdown,
            export_title: export_title
          )
        else
          SystemMessage.create_from_system_user(@current_user, :csv_export_failed)
        end
      end

      post
    end
  end
end
