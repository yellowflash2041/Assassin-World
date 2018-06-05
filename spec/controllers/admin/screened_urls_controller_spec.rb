require 'rails_helper'

describe Admin::ScreenedUrlsController do
  it "is a subclass of AdminController" do
    expect(Admin::ScreenedUrlsController < Admin::AdminController).to eq(true)
  end

  let!(:user) { log_in(:admin) }

  context '.index' do
    before do
      get :index, format: :json
    end

    subject { response }
    it { is_expected.to be_successful }

    it 'returns JSON' do
      expect(::JSON.parse(subject.body)).to be_a(Array)
    end
  end
end
