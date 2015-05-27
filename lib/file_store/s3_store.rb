require "file_store/base_store"
require_dependency "s3_helper"
require_dependency "file_helper"
require_dependency "file_store/local_store"

module FileStore

  class S3Store < BaseStore

    TOMBSTONE_PREFIX ||= "tombstone/"

    def initialize(s3_helper=nil)
      @s3_helper = s3_helper || S3Helper.new(s3_bucket, TOMBSTONE_PREFIX)
    end

    def store_upload(file, upload, content_type=nil)
      path = get_path_for_upload(upload)
      store_file(file, path, filename: upload.original_filename, content_type: content_type, cache_locally: true)
    end

    def store_optimized_image(file, optimized_image)
      path = get_path_for_optimized_image(optimized_image)
      store_file(file, path)
    end

    def remove_upload(upload)
      remove_file(upload.url)
    end

    def remove_optimized_image(optimized_image)
      remove_file(optimized_image.url)
    end

    def has_been_uploaded?(url)
      return false if url.blank?
      return true if url.start_with?(absolute_base_url)
      return true if SiteSetting.s3_cdn_url.present? && url.start_with?(SiteSetting.s3_cdn_url)
      false
    end

    def absolute_base_url
      # cf. http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
      @absolute_base_url ||= if SiteSetting.s3_region == "us-east-1"
        "//#{s3_bucket}.s3.amazonaws.com"
      else
        "//#{s3_bucket}.s3-#{SiteSetting.s3_region}.amazonaws.com"
      end
    end

    def external?
      true
    end

    def internal?
      !external?
    end

    def download(upload)
      return unless has_been_uploaded?(upload.url)

      DistributedMutex.synchronize("s3_download_#{upload.sha1}") do
        filename = "#{upload.sha1}#{File.extname(upload.original_filename)}"
        file = get_from_cache(filename)

        if !file
          max_file_size_kb = [SiteSetting.max_image_size_kb, SiteSetting.max_attachment_size_kb].max.kilobytes
          url = SiteSetting.scheme + ":" + upload.url
          file = FileHelper.download(url, max_file_size_kb, "discourse-s3", true)
          cache_file(file, filename)
        end

        file
      end
    end

    def purge_tombstone(grace_period)
      @s3_helper.update_tombstone_lifecycle(grace_period)
    end

    def path_for(upload)
      url = upload.url
      if url && url[0] == "/" && url[1] != "/"
        FileStore::LocalStore.new.path_for(upload)
      end
    end

    def cdn_url(url)
      if SiteSetting.s3_cdn_url.present?
        url.sub(absolute_base_url, SiteSetting.s3_cdn_url)
      else
        url
      end
    end

    private

      # options
      #   - filename
      #   - content_type
      #   - cache_locally
      def store_file(file, path, opts={})
        filename      = opts[:filename].presence
        content_type  = opts[:content_type].presence
        # cache file locally when needed
        cache_file(file, File.basename(path)) if opts[:cache_locally]
        # stored uploaded are public by default
        options = { acl: "public-read" }
        # add a "content disposition" header for "attachments"
        options[:content_disposition] = "attachment; filename=\"#{filename}\"" if filename && !FileHelper.is_image?(filename)
        # add a "content type" header when provided
        options[:content_type] = content_type if content_type
        # if this fails, it will throw an exception
        @s3_helper.upload(file, path, options)
        # return the upload url
        "#{absolute_base_url}/#{path}"
      end

      def remove_file(url)
        return unless has_been_uploaded?(url)
        filename = File.basename(url)
        # copy the removed file to tombstone
        @s3_helper.remove(filename, true)
      end

      CACHE_DIR ||= "#{Rails.root}/tmp/s3_cache/"
      CACHE_MAXIMUM_SIZE ||= 500

      def get_cache_path_for(filename)
        "#{CACHE_DIR}#{filename}"
      end

      def get_from_cache(filename)
        path = get_cache_path_for(filename)
        File.open(path) if File.exists?(path)
      end

      def cache_file(file, filename)
        path = get_cache_path_for(filename)
        dir = File.dirname(path)
        FileUtils.mkdir_p(dir) unless Dir[dir].present?
        FileUtils.cp(file.path, path)
        # keep up to 500 files
        `ls -tr #{CACHE_DIR} | head -n +#{CACHE_MAXIMUM_SIZE} | xargs rm -f`
      end

      def s3_bucket
        return @s3_bucket if @s3_bucket
        raise Discourse::SiteSettingMissing.new("s3_upload_bucket") if SiteSetting.s3_upload_bucket.blank?
        @s3_bucket = SiteSetting.s3_upload_bucket.downcase
      end
  end

end
