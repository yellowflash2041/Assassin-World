require 'spec_helper'

describe PermalinksController do
  describe 'show' do
    it "should redirect to a permalink's target_url with status 301" do
      permalink = Fabricate(:permalink)
      Permalink.any_instance.stubs(:target_url).returns('/t/the-topic-slug/42')
      get :show, url: permalink.url
      expect(response).to redirect_to('/t/the-topic-slug/42')
      expect(response.status).to eq(301)
    end

    it 'return 404 if permalink record does not exist' do
      get :show, url: '/not/a/valid/url'
      expect(response.status).to eq(404)
    end
  end

end
