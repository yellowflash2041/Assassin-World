require 'rails_helper'

describe Admin::SiteSettingsController do

  it "is a subclass of AdminController" do
    expect(Admin::SiteSettingsController < Admin::AdminController).to eq(true)
  end

  context 'while logged in as an admin' do
    before do
      @user = log_in(:admin)
    end

    context 'index' do
      it 'returns valid info' do
        get :index, format: :json
        json = ::JSON.parse(response.body)
        expect(json).to be_present
        expect(response.status).to eq(200)
        expect(json["site_settings"].length).to be > 100

        locale = json["site_settings"].select do |s|
          s["setting"] == "default_locale"
        end

        expect(locale.length).to eq(1)
      end
    end

    context 'update' do

      before do
        SiteSetting.setting(:test_setting, "default")
        SiteSetting.refresh!
      end

      it 'sets the value when the param is present' do
        put :update, params: {
          id: 'test_setting', test_setting: 'hello'
        }, format: :json

        expect(SiteSetting.test_setting).to eq('hello')
      end

      it 'allows value to be a blank string' do
        put :update, params: {
          id: 'test_setting', test_setting: ''
        }, format: :json

        expect(SiteSetting.test_setting).to eq('')
      end

      it 'logs the change' do
        SiteSetting.test_setting = 'previous'
        StaffActionLogger.any_instance.expects(:log_site_setting_change).with('test_setting', 'previous', 'hello')

        put :update, params: {
          id: 'test_setting', test_setting: 'hello'
        }, format: :json

        expect(SiteSetting.test_setting).to eq('hello')
      end

      it 'does not allow changing of hidden settings' do
        SiteSetting.setting(:hidden_setting, "hidden", hidden: true)
        SiteSetting.refresh!

        put :update, params: {
          id: 'hidden_setting', hidden_setting: 'not allowed'
        }, format: :json

        expect(SiteSetting.hidden_setting).to eq("hidden")
        expect(response.status).to eq(422)
      end

      it 'fails when a setting does not exist' do
        expect {
          put :update, params: { id: 'provider', provider: 'gotcha' }, format: :json
        }.to raise_error(ArgumentError)
      end
    end

  end

end
