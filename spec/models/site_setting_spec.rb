require 'spec_helper'
require_dependency 'site_setting'
require_dependency 'site_setting_extension'

describe SiteSetting do

  describe 'call_discourse_hub?' do
    it 'should be true when enforce_global_nicknames is true and discourse_org_access_key is set' do
      SiteSetting.enforce_global_nicknames = true
      SiteSetting.enforce_global_nicknames.should == true
      SiteSetting.discourse_org_access_key = 'asdfasfsafd'
      SiteSetting.call_discourse_hub?.should == true
    end

    it 'should be false when enforce_global_nicknames is false and discourse_org_access_key is set' do
      SiteSetting.enforce_global_nicknames = false
      SiteSetting.discourse_org_access_key = 'asdfasfsafd'
      SiteSetting.call_discourse_hub?.should == false
    end

    it 'should be false when enforce_global_nicknames is true and discourse_org_access_key is not set' do
      SiteSetting.enforce_global_nicknames = true
      SiteSetting.discourse_org_access_key = ''
      SiteSetting.call_discourse_hub?.should == false
    end

    it 'should be false when enforce_global_nicknames is false and discourse_org_access_key is not set' do
      SiteSetting.enforce_global_nicknames = false
      SiteSetting.discourse_org_access_key = ''
      SiteSetting.call_discourse_hub?.should == false
    end
  end

  describe 'topic_title_length' do
    it 'returns a range of min/max topic title length' do
      SiteSetting.topic_title_length.should ==
        (SiteSetting.defaults[:min_topic_title_length]..SiteSetting.defaults[:max_topic_title_length])
    end
  end

  describe 'post_length' do
    it 'returns a range of min/max post length' do
      SiteSetting.post_length.should == (SiteSetting.defaults[:min_post_length]..SiteSetting.defaults[:max_post_length])
    end
  end

  describe 'private_message_title_length' do
    it 'returns a range of min/max pm topic title length' do
      expect(SiteSetting.private_message_title_length).to eq(SiteSetting.defaults[:min_private_message_title_length]..SiteSetting.defaults[:max_topic_title_length])
    end
  end

  describe 'in test we do some judo to ensure SiteSetting is always reset between tests' do

    it 'is always the correct default' do
      expect(SiteSetting.contact_email).to eq('')
    end

    it 'sets a setting' do
      SiteSetting.contact_email = 'sam@sam.com'
    end

    it 'is always the correct default' do
      expect(SiteSetting.contact_email).to eq('')
    end

  end

end
