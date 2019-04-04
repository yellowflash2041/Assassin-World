# frozen_string_literal: true

require "aws-sdk-s3"
require "csv"

class S3Inventory

  attr_reader :inventory_id, :model, :inventory_date

  CSV_KEY_INDEX ||= 1
  CSV_ETAG_INDEX ||= 2
  INVENTORY_PREFIX ||= "inventory"
  INVENTORY_VERSION ||= "1"

  def initialize(s3_helper, type)
    @s3_helper = s3_helper

    if type == :upload
      @inventory_id = "original"
      @model = Upload
    elsif type == :optimized
      @inventory_id = "optimized"
      @model = OptimizedImage
    end
  end

  def backfill_etags_and_list_missing
    if files.blank?
      error("Failed to list inventory from S3")
      return
    end

    DistributedMutex.synchronize("s3_inventory_list_missing_#{inventory_id}") do
      download_inventory_files_to_tmp_directory
      decompress_inventory_files

      ActiveRecord::Base.transaction do
        begin
          table_name = "#{inventory_id}_inventory"
          connection = ActiveRecord::Base.connection.raw_connection
          connection.exec("CREATE TEMP TABLE #{table_name}(key text UNIQUE, etag text, PRIMARY KEY(etag, key))")
          connection.copy_data("COPY #{table_name} FROM STDIN CSV") do
            files.each do |file|
              CSV.foreach(file[:filename][0...-3], headers: false) do |row|
                connection.put_copy_data("#{row[CSV_KEY_INDEX]},#{row[CSV_ETAG_INDEX]}\n")
              end
            end
          end

          # backfilling etags
          connection.async_exec("UPDATE #{model.table_name}
            SET etag = #{table_name}.etag
            FROM #{table_name}
            WHERE #{model.table_name}.etag IS NULL
              AND url ILIKE '%' || #{table_name}.key")

          uploads = (model == Upload) ? model.by_users.where("created_at < ?", inventory_date) : model
          missing_uploads = uploads.joins("LEFT JOIN #{table_name} ON #{table_name}.etag = #{model.table_name}.etag").where("#{table_name}.etag is NULL")

          if (missing_count = missing_uploads.count) > 0
            missing_uploads.select(:id, :url).find_each do |upload|
              log upload.url
            end

            log "#{missing_count} of #{uploads.count} #{model.name.underscore.pluralize} are missing"
          end

          $redis.set("missing_s3_#{model.table_name}", missing_count)
        ensure
          connection.exec("DROP TABLE #{table_name}") unless connection.nil?
        end
      end
    end
  end

  def download_inventory_files_to_tmp_directory
    files.each do |file|
      log "Downloading inventory file '#{file[:key]}' to tmp directory..."
      failure_message = "Failed to inventory file '#{file[:key]}' to tmp directory."

      @s3_helper.download_file(file[:key], file[:filename], failure_message)
    end
  end

  def decompress_inventory_files
    FileUtils.cd(tmp_directory) do
      files.each do |file|
        log "Decompressing inventory file '#{file[:filename]}', this may take a while..."
        Discourse::Utils.execute_command('gzip', '--decompress', file[:filename], failure_message: "Failed to decompress inventory file '#{file[:filename]}'.")
      end
    end
  end

  def update_bucket_policy
    @s3_helper.s3_client.put_bucket_policy(
      bucket: bucket_name,
      policy: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "InventoryAndAnalyticsPolicy",
            "Effect": "Allow",
            "Principal": { "Service": "s3.amazonaws.com" },
            "Action": ["s3:PutObject"],
            "Resource": ["#{inventory_path_arn}/*"],
            "Condition": {
              "ArnLike": {
                "aws:SourceArn": bucket_arn
              },
              "StringEquals": {
                "s3:x-amz-acl": "bucket-owner-full-control"
              }
            }
          }
        ]
      }.to_json
    )
  end

  def update_bucket_inventory_configuration
    @s3_helper.s3_client.put_bucket_inventory_configuration(
      bucket: bucket_name,
      id: inventory_id,
      inventory_configuration: inventory_configuration,
      use_accelerate_endpoint: false
    )
  end

  private

  def files
    @files ||= begin
      symlink_file = unsorted_files.sort_by { |file| -file.last_modified.to_i }.first
      return [] if symlink_file.blank?

      @inventory_date = symlink_file.last_modified - 1.day
      log "Downloading symlink file to tmp directory..."
      failure_message = "Failed to download symlink file to tmp directory."
      filename = File.join(tmp_directory, File.basename(symlink_file.key))

      @s3_helper.download_file(symlink_file.key, filename, failure_message)
      File.readlines(filename).map do |key|
        key = key.sub("s3://#{bucket_name}/", "").sub("\n", "")
        { key: key, filename: File.join(tmp_directory, File.basename(key)) }
      end
    end
  end

  def tmp_directory
    @tmp_directory ||= begin
      current_db = RailsMultisite::ConnectionManagement.current_db
      timestamp = Time.now.strftime("%Y-%m-%d-%H%M%S")
      directory = File.join(Rails.root, "tmp", INVENTORY_PREFIX, current_db, timestamp)
      FileUtils.mkdir_p(directory)
      directory
    end
  end

  def inventory_configuration
    filter_prefix = inventory_id
    filter_prefix = File.join(bucket_folder_path, filter_prefix) if bucket_folder_path.present?

    {
      destination: {
        s3_bucket_destination: {
          bucket: bucket_arn,
          prefix: inventory_path,
          format: "CSV"
        }
      },
      filter: {
        prefix: filter_prefix
      },
      is_enabled: SiteSetting.enable_s3_inventory,
      id: inventory_id,
      included_object_versions: "Current",
      optional_fields: ["ETag"],
      schedule: {
        frequency: "Daily"
      }
    }
  end

  def bucket_name
    @s3_helper.s3_bucket_name
  end

  def bucket_folder_path
    @s3_helper.s3_bucket_folder_path
  end

  def unsorted_files
    objects = []

    hive_path = File.join(inventory_path, bucket_name, inventory_id, "hive")
    @s3_helper.list(hive_path).each do |obj|
      if obj.key.match?(/symlink\.txt$/i)
        objects << obj
      end
    end

    objects
  rescue Aws::Errors::ServiceError => e
    log("Failed to list inventory from S3", e)
  end

  def inventory_path_arn
    File.join(bucket_arn, inventory_path)
  end

  def inventory_path
    path = File.join(INVENTORY_PREFIX, INVENTORY_VERSION)
    path = File.join(bucket_folder_path, path) if bucket_folder_path.present?
    path
  end

  def bucket_arn
    "arn:aws:s3:::#{bucket_name}"
  end

  def log(message, ex = nil)
    puts(message)
    Rails.logger.error("#{ex}\n" + (ex.backtrace || []).join("\n")) if ex
  end

  def error(message)
    log(message, StandardError.new(message))
  end
end
