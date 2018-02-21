require 'rails_helper'

RSpec.describe ListController do
  let(:topic) { Fabricate(:topic) }

  describe '#index' do
    it "doesn't throw an error with a negative page" do
      get "/#{Discourse.anonymous_filters[1]}", params: { page: -1024 }
      expect(response).to be_success
    end

    it "doesn't throw an error with page params as an array" do
      get "/#{Discourse.anonymous_filters[1]}", params: { page: ['7'] }
      expect(response).to be_success
    end
  end

  describe 'suppress from latest' do

    it 'supresses categories' do
      topic

      get "/latest.json"
      data = JSON.parse(response.body)
      expect(data["topic_list"]["topics"].length).to eq(1)

      get "/categories_and_latest.json"
      data = JSON.parse(response.body)
      expect(data["topic_list"]["topics"].length).to eq(1)

      topic.category.suppress_from_latest = true
      topic.category.save

      get "/latest.json"
      data = JSON.parse(response.body)
      expect(data["topic_list"]["topics"].length).to eq(0)

      get "/categories_and_latest.json"
      data = JSON.parse(response.body)
      expect(data["topic_list"]["topics"].length).to eq(0)
    end

  end

  describe 'titles for crawler layout' do
    it 'has no title for the default URL' do
      topic
      filter = Discourse.anonymous_filters[0]
      get "/#{filter}", params: { _escaped_fragment_: 'true' }

      expect(response.body).to include(I18n.t("rss_description.posts"))

      expect(response.body).to_not include(
        I18n.t('js.filters.with_topics', filter: filter)
      )
    end

    it 'has a title for non-default URLs' do
      topic
      filter = Discourse.anonymous_filters[1]
      get "/#{filter}", params: { _escaped_fragment_: 'true' }

      expect(response.body).to include(
        I18n.t('js.filters.with_topics', filter: filter)
      )
    end
  end
end
