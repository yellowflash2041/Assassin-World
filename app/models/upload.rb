require 'digest/sha1'

class Upload < ActiveRecord::Base
  belongs_to :user
  belongs_to :topic

  validates_presence_of :filesize
  validates_presence_of :original_filename

  # Create an upload given a user, file and topic
  def self.create_for(user_id, file, topic_id)
    return create_on_imgur(user_id, file, topic_id) if SiteSetting.enable_imgur?
    return create_on_s3(user_id, file, topic_id) if SiteSetting.enable_s3_uploads?
    return create_locally(user_id, file, topic_id)
  end

  # Store uploads on imgur
  def self.create_on_imgur(user_id, file, topic_id)
    @imgur_loaded = require 'imgur' unless @imgur_loaded

    info = Imgur.upload_file(file)

    Upload.create!({
      user_id: user_id,
      topic_id: topic_id,
      original_filename: file.original_filename
    }.merge!(info))
  end

  # Store uploads on s3
  def self.create_on_s3(user_id, file, topic_id)
    @fog_loaded = require 'fog' unless @fog_loaded

    tempfile = file.tempfile

    upload = Upload.new(user_id: user_id,
                        topic_id: topic_id,
                        filesize: File.size(tempfile),
                        original_filename: file.original_filename)

    image_info = FastImage.new(tempfile, raise_on_failure: true)
    blob = file.read
    sha1 = Digest::SHA1.hexdigest(blob)
    remote_filename = "#{sha1}.#{image_info.type}"

    fog = Fog::Storage.new(
      aws_access_key_id: SiteSetting.s3_access_key_id,
      aws_secret_access_key: SiteSetting.s3_secret_access_key,
      region: SiteSetting.s3_region,
      provider: 'AWS'
    )

    directory = fog.directories.create(key: SiteSetting.s3_upload_bucket)

    file = directory.files.create(
      key: remote_filename,
      body: tempfile,
      public: true,
      content_type: file.content_type
    )
    
    upload.width, upload.height = ImageSizer.resize(*image_info.size)
    upload.url = "//#{SiteSetting.s3_upload_bucket}.s3-#{SiteSetting.s3_region}.amazonaws.com/#{remote_filename}"

    upload.save

    upload
  end

  def self.create_locally(user_id, file, topic_id)
    upload = Upload.create!({
      user_id: user_id,
      topic_id: topic_id,
      url: "",
      filesize: File.size(file.tempfile),
      original_filename: file.original_filename
    })

    # populate the rest of the info
    clean_name = Digest::SHA1.hexdigest("#{Time.now.to_s}#{file.original_filename}")[0,16]
    image_info = FastImage.new(file.tempfile, raise_on_failure: true)
    clean_name += ".#{image_info.type}"
    url_root = "/uploads/#{RailsMultisite::ConnectionManagement.current_db}/#{upload.id}"
    path = "#{Rails.root}/public#{url_root}"

    FileUtils.mkdir_p path
    # not using cause mv, cause permissions are no good on move
    File.open("#{path}/#{clean_name}", "wb") do |f|
      f.write File.read(file.tempfile)
    end

    upload.width, upload.height = ImageSizer.resize(*image_info.size)
    upload.url = Discourse::base_uri + "#{url_root}/#{clean_name}"

    upload.save

    upload
  end

end

# == Schema Information
#
# Table name: uploads
#
#  id                :integer          not null, primary key
#  user_id           :integer          not null
#  topic_id          :integer          not null
#  original_filename :string(255)      not null
#  filesize          :integer          not null
#  width             :integer
#  height            :integer
#  url               :string(255)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  index_uploads_on_forum_thread_id  (topic_id)
#  index_uploads_on_user_id          (user_id)
#

