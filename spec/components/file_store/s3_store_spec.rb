require 'rails_helper'
require 'file_store/s3_store'
require 'file_store/local_store'

describe FileStore::S3Store do

  let(:s3_helper) { stub }
  let(:store) { FileStore::S3Store.new(s3_helper) }

  let(:upload) { Fabricate(:upload) }
  let(:uploaded_file) { file_from_fixtures("logo.png") }

  let(:optimized_image) { Fabricate(:optimized_image) }
  let(:optimized_image_file) { file_from_fixtures("logo.png") }

  before(:each) do
    SiteSetting.s3_upload_bucket = "s3-upload-bucket"
    SiteSetting.s3_access_key_id = "s3-access-key-id"
    SiteSetting.s3_secret_access_key = "s3-secret-access-key"
  end

  describe ".store_upload" do

    it "returns an absolute schemaless url" do
      s3_helper.expects(:upload)
      expect(store.store_upload(uploaded_file, upload)).to match(/\/\/s3-upload-bucket\.s3\.amazonaws\.com\/original\/.+#{upload.sha1}\.png/)
    end

  end

  describe ".store_optimized_image" do

    it "returns an absolute schemaless url" do
      s3_helper.expects(:upload)
      expect(store.store_optimized_image(optimized_image_file, optimized_image)).to match(/\/\/s3-upload-bucket\.s3\.amazonaws\.com\/optimized\/.+#{optimized_image.upload.sha1}_#{OptimizedImage::VERSION}_100x200\.png/)
    end

  end

  context 'removal from s3' do
    let(:store) { FileStore::S3Store.new }
    let(:client) { Aws::S3::Client.new(stub_responses: true) }
    let(:resource) { Aws::S3::Resource.new(client: client) }
    let(:s3_bucket) { resource.bucket("s3-upload-bucket") }
    let(:s3_helper) { store.instance_variable_get(:@s3_helper) }

    before do
      SiteSetting.s3_region = 'us-west-1'
    end

    describe ".remove_upload" do
      it "removes the file from s3 with the right paths" do
        s3_helper.expects(:s3_bucket).returns(s3_bucket)
        upload.update_attributes!(url: "//s3-upload-bucket.s3-us-west-1.amazonaws.com/original/1X/#{upload.sha1}.png")
        s3_object = stub

        s3_bucket.expects(:object).with("tombstone/original/1X/#{upload.sha1}.png").returns(s3_object)
        s3_object.expects(:copy_from).with(copy_source: "s3-upload-bucket/original/1X/#{upload.sha1}.png")
        s3_bucket.expects(:object).with("original/1X/#{upload.sha1}.png").returns(s3_object)
        s3_object.expects(:delete)

        store.remove_upload(upload)
      end
    end

    describe ".remove_optimized_image" do
      let(:optimized_image) do
        Fabricate(:optimized_image,
          url: "//s3-upload-bucket.s3-us-west-1.amazonaws.com/optimized/1X/#{upload.sha1}_1_100x200.png",
          upload: upload
        )
      end

      it "removes the file from s3 with the right paths" do
        s3_helper.expects(:s3_bucket).returns(s3_bucket)
        s3_object = stub

        s3_bucket.expects(:object).with("tombstone/optimized/1X/#{upload.sha1}_1_100x200.png").returns(s3_object)
        s3_object.expects(:copy_from).with(copy_source: "s3-upload-bucket/optimized/1X/#{upload.sha1}_1_100x200.png")
        s3_bucket.expects(:object).with("optimized/1X/#{upload.sha1}_1_100x200.png").returns(s3_object)
        s3_object.expects(:delete)

        store.remove_optimized_image(optimized_image)
      end
    end
  end

  describe ".has_been_uploaded?" do

    it "identifies S3 uploads" do
      expect(store.has_been_uploaded?("//s3-upload-bucket.s3.amazonaws.com/1337.png")).to eq(true)
    end

    it "does not match other s3 urls" do
      expect(store.has_been_uploaded?("//s3-upload-bucket.s3-us-east-1.amazonaws.com/1337.png")).to eq(false)
      expect(store.has_been_uploaded?("//s3.amazonaws.com/s3-upload-bucket/1337.png")).to eq(false)
      expect(store.has_been_uploaded?("//s4_upload_bucket.s3.amazonaws.com/1337.png")).to eq(false)
    end

  end

  describe ".absolute_base_url" do

    it "returns a lowercase schemaless absolute url" do
      expect(store.absolute_base_url).to eq("//s3-upload-bucket.s3.amazonaws.com")
    end

    it "uses the proper endpoint" do
      SiteSetting.stubs(:s3_region).returns("us-east-1")
      expect(FileStore::S3Store.new(s3_helper).absolute_base_url).to eq("//s3-upload-bucket.s3.amazonaws.com")

      SiteSetting.stubs(:s3_region).returns("us-east-2")
      expect(FileStore::S3Store.new(s3_helper).absolute_base_url).to eq("//s3-upload-bucket.s3-us-east-2.amazonaws.com")

      SiteSetting.stubs(:s3_region).returns("cn-north-1")
      expect(FileStore::S3Store.new(s3_helper).absolute_base_url).to eq("//s3-upload-bucket.s3.cn-north-1.amazonaws.com.cn")

    end

  end

  it "is external" do
    expect(store.external?).to eq(true)
    expect(store.internal?).to eq(false)
  end

  describe ".purge_tombstone" do

    it "updates tombstone lifecycle" do
      s3_helper.expects(:update_tombstone_lifecycle)
      store.purge_tombstone(1.day)
    end

  end

  describe ".path_for" do

    def assert_path(path, expected)
      upload = Upload.new(url: path)

      path = store.path_for(upload)
      expected = FileStore::LocalStore.new.path_for(upload) if expected

      expect(path).to eq(expected)
    end

    it "correctly falls back to local" do
      assert_path("/hello", "/hello")
      assert_path("//hello", nil)
      assert_path("http://hello", nil)
      assert_path("https://hello", nil)
    end
  end

end
