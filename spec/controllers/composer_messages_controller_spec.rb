require 'rails_helper'

describe ComposerMessagesController do

  context '.index' do

    it 'requires you to be logged in' do
      get :index, format: :json
      expect(response.status).to eq(403)
    end

    context 'when logged in' do
      let!(:user) { log_in }
      let(:args) { { 'topic_id' => '123', 'post_id' => '333', 'composer_action' => 'reply' } }

      it 'redirects to your user preferences' do
        get :index, format: :json
        expect(response).to be_successful
      end

      it 'delegates args to the finder' do
        finder = mock
        ComposerMessagesFinder.expects(:new).with(instance_of(User), has_entries(args)).returns(finder)
        finder.expects(:find)
        get :index, params: args, format: :json
      end
    end
  end
end
