require 'spec_helper'
require_dependency 'site_setting_extension'
require_dependency 'site_settings/local_process_provider'

describe SiteSettingExtension do


  let :provider do
    SiteSettings::LocalProcessProvider.new
  end

  def new_settings(provider)
    c = Class.new
    c.class_eval do
      extend SiteSettingExtension
      self.provider = provider
    end

    c
  end

  let :settings do
    new_settings(provider)
  end

  let :settings2 do
    new_settings(provider)
  end

  describe "refresh!" do

    it "will reset to default if provider vanishes" do
      settings.setting(:hello, 1)
      settings.hello = 100
      settings.hello.should == 100

      settings.provider.clear
      settings.refresh!

      settings.hello.should == 1
    end

    it "will set to new value if provider changes" do

      settings.setting(:hello, 1)
      settings.hello = 100
      settings.hello.should == 100

      settings.provider.save(:hello, 99, SiteSetting.types[:fixnum] )
      settings.refresh!

      settings.hello.should == 99
    end

    it "Publishes changes cross sites" do
      settings.setting(:hello, 1)
      settings2.setting(:hello, 1)

      settings.hello = 100

      settings2.refresh!
      settings2.hello.should == 100

      settings.hello = 99

      settings2.refresh!
      settings2.hello.should == 99
    end

  end

  describe "multisite" do
    it "has no db cross talk" do
      settings.setting(:hello, 1)
      settings.hello = 100
      settings.provider.current_site = "boom"
      settings.hello.should == 1
    end
  end

  describe "int setting" do
    before do
      settings.setting(:test_setting, 77)
      settings.refresh!
    end

    it "should have a key in all_settings" do
      settings.all_settings.detect {|s| s[:setting] == :test_setting }.should be_present
    end

    it "should have the correct desc" do
      I18n.expects(:t).with("site_settings.test_setting").returns("test description")
      settings.description(:test_setting).should == "test description"
    end

    it "should have the correct default" do
      settings.test_setting.should == 77
    end

    context "when overidden" do
      after :each do
        settings.remove_override!(:test_setting)
      end

      it "should have the correct override" do
        settings.test_setting = 100
        settings.test_setting.should == 100
      end

      it "should coerce correct string to int" do
        settings.test_setting = "101"
        settings.test_setting.should.eql? 101
      end

      it "should coerce incorrect string to 0" do
        settings.test_setting = "pie"
        settings.test_setting.should.eql? 0
      end

			it "should not set default when reset" do
        settings.test_setting = 100
        settings.setting(:test_setting, 77)
        settings.refresh!
        settings.test_setting.should_not == 77
      end

      it "can be overridden with set" do
        settings.set("test_setting", 12)
        settings.test_setting.should == 12
      end
    end
  end

  describe "remove_override" do
    it "correctly nukes overrides" do
      settings.setting(:test_override, "test")
      settings.test_override = "bla"
      settings.remove_override!(:test_override)
      expect(settings.test_override).to eq("test")
    end
  end

  describe "string setting" do
    before do
      settings.setting(:test_str, "str")
      settings.refresh!
    end

    it "should have the correct default" do
      settings.test_str.should == "str"
    end

    context "when overridden" do
      after :each do
        settings.remove_override!(:test_str)
      end

      it "should coerce int to string" do
        settings.test_str = 100
        settings.test_str.should.eql? "100"
      end

      it "can be overridden with set" do
        settings.set("test_str", "hi")
        settings.test_str.should == "hi"
      end
    end
  end

  describe "bool setting" do
    before do
      settings.setting(:test_hello?, false)
      settings.refresh!
    end

    it "should have the correct default" do
      settings.test_hello?.should == false
    end

    context "when overridden" do
      after do
        settings.remove_override!(:test_hello?)
      end

      it "should have the correct override" do
        settings.test_hello = true
        settings.test_hello?.should == true
      end

      it "should coerce true strings to true" do
        settings.test_hello = "true"
        settings.test_hello?.should.eql? true
      end

      it "should coerce all other strings to false" do
        settings.test_hello = "f"
        settings.test_hello?.should.eql? false
      end

			it "should not set default when reset" do
        settings.test_hello = true
        settings.setting(:test_hello?, false)
        settings.refresh!
        settings.test_hello?.should_not == false
      end

      it "can be overridden with set" do
        settings.set("test_hello", true)
        settings.test_hello?.should == true
      end
    end
  end

  describe 'enum setting' do

    class TestEnumClass
      def self.valid_value?(v)
        true
      end
      def self.values
        ['en']
      end
      def self.translate_names?
        false
      end
    end

    let :test_enum_class do
      TestEnumClass
    end

    before do
      settings.setting(:test_enum, 'en', enum: test_enum_class)
      settings.refresh!
    end

    it 'should have the correct default' do
      expect(settings.test_enum).to eq('en')
    end

    it 'should not hose all_settings' do
      settings.all_settings.detect {|s| s[:setting] == :test_enum }.should be_present
    end

    context 'when overridden' do
      after :each do
        settings.remove_override!(:validated_setting)
      end

      it 'stores valid values' do
        test_enum_class.expects(:valid_value?).with('fr').returns(true)
        settings.test_enum = 'fr'
        expect(settings.test_enum).to eq('fr')
      end

      it 'rejects invalid values' do
        test_enum_class.expects(:valid_value?).with('gg').returns(false)
        expect {settings.test_enum = 'gg' }.to raise_error(Discourse::InvalidParameters)
      end
    end
  end

  describe 'a setting with a category' do
    before do
      settings.setting(:test_setting, 88, {category: :tests})
      settings.refresh!
    end

    it "should return the category in all_settings" do
      settings.all_settings.find {|s| s[:setting] == :test_setting }[:category].should == :tests
    end

    context "when overidden" do
      after :each do
        settings.remove_override!(:test_setting)
      end

      it "should have the correct override" do
        settings.test_setting = 101
        settings.test_setting.should == 101
      end

      it "should still have the correct category" do
        settings.test_setting = 102
        settings.all_settings.find {|s| s[:setting] == :test_setting }[:category].should == :tests
      end
    end
  end

  describe "setting with a validator" do
    before do
      settings.setting(:validated_setting, "info@example.com", {type: 'email'})
      settings.refresh!
    end

    after :each do
      settings.remove_override!(:validated_setting)
    end

    it "stores valid values" do
      EmailSettingValidator.any_instance.expects(:valid_value?).returns(true)
      settings.validated_setting = 'success@example.com'
      settings.validated_setting.should == 'success@example.com'
    end

    it "rejects invalid values" do
      expect {
        EmailSettingValidator.any_instance.expects(:valid_value?).returns(false)
        settings.validated_setting = 'nope'
      }.to raise_error(Discourse::InvalidParameters)
      settings.validated_setting.should == "info@example.com"
    end

    it "allows blank values" do
      settings.validated_setting = ''
      settings.validated_setting.should == ''
    end
  end

  describe "set for an invalid setting name" do
    it "raises an error" do
      settings.setting(:test_setting, 77)
      settings.refresh!
      expect {
        settings.set("provider", "haxxed")
      }.to raise_error(ArgumentError)
    end
  end

  describe "filter domain name" do
    before do
      settings.setting(:white_listed_spam_host_domains, "www.example.com")
      settings.refresh!
    end

    it "filters domain" do
      settings.set("white_listed_spam_host_domains", "http://www.discourse.org/")
      settings.white_listed_spam_host_domains.should == "www.discourse.org"
    end

    it "returns invalid domain as is, without throwing exception" do
      settings.set("white_listed_spam_host_domains", "test!url")
      settings.white_listed_spam_host_domains.should == "test!url"
    end
  end

  describe "hidden" do
    before do
      settings.setting(:superman_identity, 'Clark Kent', hidden: true)
      settings.refresh!
    end

    it "is in the `hidden_settings` collection" do
      settings.hidden_settings.include?(:superman_identity).should == true
    end

    it "can be retrieved" do
      settings.superman_identity.should == "Clark Kent"
    end

    it "is not present in all_settings by default" do
      settings.all_settings.find {|s| s[:setting] == :superman_identity }.should be_blank
    end

    it "is present in all_settings when we ask for hidden" do
      settings.all_settings(true).find {|s| s[:setting] == :superman_identity }.should be_present
    end
  end

  describe "shadowed_by_global" do
    context "without global setting" do
      before do
        settings.setting(:trout_api_key, 'evil', shadowed_by_global: true)
        settings.refresh!
      end

      it "should not add the key to the shadowed_settings collection" do
        settings.shadowed_settings.include?(:trout_api_key).should == false
      end

      it "can return the default value" do
        settings.trout_api_key.should == 'evil'
      end

      it "can overwrite the default" do
        settings.trout_api_key = 'tophat'
        settings.refresh!
        settings.trout_api_key.should == 'tophat'
      end
    end

    context "with global setting" do
      before do
        GlobalSetting.stubs(:trout_api_key).returns('purringcat')
        settings.setting(:trout_api_key, 'evil', shadowed_by_global: true)
        settings.refresh!
      end

      it "should return the global setting instead of default" do
        settings.trout_api_key.should == 'purringcat'
      end

      it "should return the global setting after a refresh" do
        settings.refresh!
        settings.trout_api_key.should == 'purringcat'
      end

      it "should add the key to the shadowed_settings collection" do
        settings.shadowed_settings.include?(:trout_api_key).should == true
      end
    end
  end

end
