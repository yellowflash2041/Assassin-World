require 'rails_helper'

describe OneboxController do

  let(:url) { "http://google.com" }

  it "requires the user to be logged in" do
    get :show, params: { url: url }, format: :json
    expect(response.status).to eq(403)
  end

  describe "logged in" do

    before { @user = log_in(:admin) }

    it 'invalidates the cache if refresh is passed' do
      Oneboxer.expects(:preview).with(url, invalidate_oneboxes: true, user_id: @user.id, category_id: 0)
      get :show, params: { url: url, refresh: 'true' }, format: :json
    end

    describe "cached onebox" do

      it "returns the cached onebox response in the body" do
        onebox_html = <<~HTML
          <html>
          <head>
            <meta property="og:title" content="Fred the title">
            <meta property="og:description" content="this is bodycontent">
          </head>
          <body>
             <p>body</p>
          </body>
          <html>
        HTML

        url = "http://noodle.com/"

        stub_request(:head, url).
          to_return(status: 200, body: "", headers: {}).then.to_raise

        stub_request(:get, url)
          .to_return(status: 200, headers: {}, body: onebox_html).then.to_raise

        get :show, params: { url: url, refresh: "true" }, format: :json

        expect(response).to be_success
        expect(response.body).to include('Fred')
        expect(response.body).to include('bodycontent')

        get :show, params: { url: url }, format: :json
        expect(response).to be_success
        expect(response.body).to include('Fred')
        expect(response.body).to include('bodycontent')
      end

    end

    describe "only 1 outgoing preview per user" do

      it "returns 429" do
        Oneboxer.expects(:is_previewing?).returns(true)
        get :show, params: { url: url }, format: :json
        expect(response.status).to eq(429)
      end

    end

    describe "found onebox" do

      let(:body) { "this is the onebox body" }

      before do
        Oneboxer.expects(:preview).returns(body)
        get :show, params: { url: url }, format: :json
      end

      it 'returns the onebox response in the body' do
        expect(response).to be_success
        expect(response.body).to eq(body)
      end

    end

    describe "missing onebox" do

      it "returns 404 if the onebox is nil" do
        Oneboxer.expects(:preview).returns(nil)
        get :show, params: { url: url }, format: :json
        expect(response.response_code).to eq(404)
      end

      it "returns 404 if the onebox is an empty string" do
        Oneboxer.expects(:preview).returns(" \t ")
        get :show, params: { url: url }, format: :json
        expect(response.response_code).to eq(404)
      end

    end

    describe "local onebox" do

      it 'does not cache local oneboxes' do
        post1 = create_post
        url = Discourse.base_url + post1.url

        get :show, params: { url: url, category_id: post1.topic.category_id }, format: :json
        expect(response.body).to include('blockquote')

        post1.trash!

        get :show, params: { url: url, category_id: post1.topic.category_id }, format: :json
        expect(response.body).not_to include('blockquote')
      end
    end

  end

  it 'does not onebox when you have no permission on category' do
    log_in

    post1 = create_post
    url = Discourse.base_url + post1.url

    get :show, params: { url: url, category_id: post1.topic.category_id }, format: :json
    expect(response.body).to include('blockquote')

    post1.topic.category.set_permissions(staff: :full)
    post1.topic.category.save

    get :show, params: { url: url, category_id: post1.topic.category_id }, format: :json
    expect(response.body).not_to include('blockquote')
  end

end
