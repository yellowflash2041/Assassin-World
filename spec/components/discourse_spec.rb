require 'rails_helper'
require 'discourse'

describe Discourse do

  before do
    RailsMultisite::ConnectionManagement.stubs(:current_hostname).returns('foo.com')
  end

  context 'current_hostname' do

    it 'returns the hostname from the current db connection' do
      expect(Discourse.current_hostname).to eq('foo.com')
    end

  end

  context 'base_url' do
    context 'when https is off' do
      before do
        SiteSetting.expects(:use_https?).returns(false)
      end

      it 'has a non https base url' do
        expect(Discourse.base_url).to eq("http://foo.com")
      end
    end

    context 'when https is on' do
      before do
        SiteSetting.expects(:use_https?).returns(true)
      end

      it 'has a non-ssl base url' do
        expect(Discourse.base_url).to eq("https://foo.com")
      end
    end

    context 'with a non standard port specified' do
      before do
        SiteSetting.stubs(:port).returns(3000)
      end

      it "returns the non standart port in the base url" do
        expect(Discourse.base_url).to eq("http://foo.com:3000")
      end
    end
  end

  context '#site_contact_user' do

    let!(:admin) { Fabricate(:admin) }
    let!(:another_admin) { Fabricate(:admin) }

    it 'returns the user specified by the site setting site_contact_username' do
      SiteSetting.stubs(:site_contact_username).returns(another_admin.username)
      expect(Discourse.site_contact_user).to eq(another_admin)
    end

    it 'returns the user specified by the site setting site_contact_username regardless of its case' do
      SiteSetting.stubs(:site_contact_username).returns(another_admin.username.upcase)
      expect(Discourse.site_contact_user).to eq(another_admin)
    end

    it 'returns the system user otherwise' do
      SiteSetting.stubs(:site_contact_username).returns(nil)
      expect(Discourse.site_contact_user.username).to eq("system")
    end

  end

  context "#store" do

    it "returns LocalStore by default" do
      expect(Discourse.store).to be_a(FileStore::LocalStore)
    end

    it "returns S3Store when S3 is enabled" do
      SiteSetting.stubs(:enable_s3_uploads?).returns(true)
      SiteSetting.stubs(:s3_upload_bucket).returns("s3_bucket")
      SiteSetting.stubs(:s3_access_key_id).returns("s3_access_key_id")
      SiteSetting.stubs(:s3_secret_access_key).returns("s3_secret_access_key")
      expect(Discourse.store).to be_a(FileStore::S3Store)
    end

  end

  context 'readonly mode' do
    let(:readonly_channel) { Discourse.readonly_channel }
    let(:readonly_key) { Discourse.readonly_mode_key }
    let(:readonly_mode_ttl) { Discourse::READONLY_MODE_KEY_TTL }

    after do
      $redis.del(readonly_key)
    end

    def assert_readonly_mode(message, channel, key, ttl)
      expect(message.channel).to eq(channel)
      expect(message.data).to eq(true)
      expect($redis.get(key)).to eq("1")
      expect($redis.ttl(key)).to eq(ttl)
    end

    def assert_readonly_mode_disabled(message, channel, key)
      expect(message.channel).to eq(channel)
      expect(message.data).to eq(false)
      expect($redis.get(key)).to eq(nil)
    end

    context ".enable_readonly_mode" do
      it "adds a key in redis and publish a message through the message bus" do
        expect($redis.get(readonly_key)).to eq(nil)
        message = MessageBus.track_publish { Discourse.enable_readonly_mode }.first
        assert_readonly_mode(message, readonly_channel, readonly_key, readonly_mode_ttl)
      end
    end

    context ".disable_readonly_mode" do
      it "removes a key from redis and publish a message through the message bus" do
        Discourse.enable_readonly_mode

        message = MessageBus.track_publish do
          Discourse.disable_readonly_mode
        end.first

        assert_readonly_mode_disabled(message, readonly_channel, readonly_key)
      end
    end

    context ".readonly_mode?" do
      it "is false by default" do
        expect(Discourse.readonly_mode?).to eq(false)
      end

      it "returns true when the key is present in redis" do
        $redis.set(readonly_key, 1)
        expect(Discourse.readonly_mode?).to eq(true)
      end

      it "returns true when Discourse is recently read only" do
        Discourse.received_readonly!
        expect(Discourse.readonly_mode?).to eq(true)
      end
    end

    context ".received_readonly!" do
      it "sets the right time" do
        time = Discourse.received_readonly!
        expect(Discourse.last_read_only['default']).to eq(time)
      end
    end
  end

  context "#handle_exception" do

    class TempSidekiqLogger < Sidekiq::ExceptionHandler::Logger
      attr_accessor :exception, :context
      def call(ex, ctx)
        self.exception = ex
        self.context = ctx
      end
    end

    let!(:logger) { TempSidekiqLogger.new }

    before do
      Sidekiq.error_handlers.clear
      Sidekiq.error_handlers << logger
    end

    it "should not fail when called" do
      exception = StandardError.new

      Discourse.handle_job_exception(exception, nil, nil)
      expect(logger.exception).to eq(exception)
      expect(logger.context.keys).to eq([:current_db, :current_hostname])
    end

    it "correctly passes extra context" do
      exception = StandardError.new

      Discourse.handle_job_exception(exception, {message: "Doing a test", post_id: 31}, nil)
      expect(logger.exception).to eq(exception)
      expect(logger.context.keys.sort).to eq([:current_db, :current_hostname, :message, :post_id].sort)
    end
  end

end

