module S3

  def self.store_file(file, sha1, image_info, upload_id)
    S3.check_missing_site_settings

    directory = S3.get_or_create_directory(SiteSetting.s3_upload_bucket)

    remote_filename = "#{upload_id}#{sha1}.#{image_info.type}"

    # if this fails, it will throw an exception
    file = S3.upload(file, remote_filename, directory)
    "#{S3.base_url}/#{remote_filename}"
  end

  def self.base_url
    "//#{SiteSetting.s3_upload_bucket}.s3.amazonaws.com"
  end

  def self.remove_file(url)
    S3.check_missing_site_settings

    directory = S3.get_or_create_directory(SiteSetting.s3_upload_bucket)

    file = S3.destroy(url, directory)
  end

  def self.check_missing_site_settings
    raise Discourse::SiteSettingMissing.new("s3_upload_bucket")     if SiteSetting.s3_upload_bucket.blank?
    raise Discourse::SiteSettingMissing.new("s3_access_key_id")     if SiteSetting.s3_access_key_id.blank?
    raise Discourse::SiteSettingMissing.new("s3_secret_access_key") if SiteSetting.s3_secret_access_key.blank?
  end

  def self.get_or_create_directory(name)
    @fog_loaded = require 'fog' unless @fog_loaded

    options = S3.generate_options

    fog = Fog::Storage.new(options)

    directory = fog.directories.get(name)
    directory = fog.directories.create(key: name) unless directory

    directory
  end

  def self.generate_options
    options = {
      provider: 'AWS',
      aws_access_key_id: SiteSetting.s3_access_key_id,
      aws_secret_access_key: SiteSetting.s3_secret_access_key
    }
    options[:region] = SiteSetting.s3_region unless SiteSetting.s3_region.empty?

    options
  end

  def self.upload(file, name, directory)
    directory.files.create(
      key: name,
      public: true,
      body: file.tempfile,
      content_type: file.content_type
    )
  end

  def self.destroy(name, directory)
    directory.files.destroy(key: name)
  end

end
