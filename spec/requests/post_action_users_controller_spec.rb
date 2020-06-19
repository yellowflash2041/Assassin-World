# frozen_string_literal: true

require 'rails_helper'

describe PostActionUsersController do
  fab!(:user) { Fabricate(:user) }
  let(:post) { Fabricate(:post, user: sign_in(user)) }

  context 'with render' do
    it 'always allows you to see your own actions' do
      notify_mod = PostActionType.types[:notify_moderators]

      PostActionCreator.new(post.user, post, notify_mod, message: 'well something is wrong here!').perform
      PostActionCreator.new(Fabricate(:user), post, notify_mod, message: 'well something is not wrong here!').perform

      get "/post_action_users.json", params: { id: post.id, post_action_type_id: notify_mod }
      expect(response.status).to eq(200)

      users = response.parsed_body["post_action_users"]

      expect(users.length).to eq(1)
      expect(users[0]["id"]).to eq(post.user.id)
    end
  end

  it 'raises an error without an id' do
    get "/post_action_users.json", params: { post_action_type_id: PostActionType.types[:like] }
    expect(response.status).to eq(400)
  end

  it 'raises an error without a post action type' do
    get "/post_action_users.json", params: { id: post.id }
    expect(response.status).to eq(400)
  end

  it "fails when the user doesn't have permission to see the post" do
    post.trash!
    get "/post_action_users.json", params: {
      id: post.id, post_action_type_id: PostActionType.types[:like]
    }

    expect(response).to be_forbidden
  end

  it 'raises an error when anon tries to look at an invalid action' do
    get "/post_action_users.json", params: {
      id: Fabricate(:post).id,
      post_action_type_id: PostActionType.types[:notify_moderators]
    }

    expect(response).to be_forbidden
  end

  it 'succeeds' do
    get "/post_action_users.json", params: {
      id: post.id, post_action_type_id: PostActionType.types[:like]
    }

    expect(response.status).to eq(200)
  end

  it 'will return an unknown attribute for muted users' do
    ignored_user = Fabricate(:user)
    PostActionCreator.like(ignored_user, post)
    regular_user = Fabricate(:user)
    PostActionCreator.like(regular_user, post)
    IgnoredUser.create(user: user, ignored_user: ignored_user)

    get "/post_action_users.json", params: {
      id: post.id, post_action_type_id: PostActionType.types[:like]
    }
    expect(response.status).to eq(200)
    json_users = response.parsed_body['post_action_users']
    expect(json_users.find { |u| u['id'] == regular_user.id }['unknown']).to be_blank
    expect(json_users.find { |u| u['id'] == ignored_user.id }['unknown']).to eq(true)
  end

  it "paginates post actions" do
    user_ids = []
    5.times do
      user = Fabricate(:user)
      user_ids << user["id"]
      PostActionCreator.like(user, post)
    end

    get "/post_action_users.json",
      params: { id: post.id, post_action_type_id: PostActionType.types[:like], page: 1, limit: 2 }

    users = response.parsed_body["post_action_users"]
    total = response.parsed_body["total_rows_post_action_users"]

    expect(users.length).to eq(2)
    expect(users.map { |u| u["id"] }).to eq(user_ids[2..3])

    expect(total).to eq(5)
  end

  it 'returns no users when the action type id is invalid' do
    get "/post_action_users.json", params: {
      id: post.id, post_action_type_id: "invalid_action_type"
    }

    expect(response.status).to eq(200)

    users = response.parsed_body["post_action_users"]
    total = response.parsed_body["total_rows_post_action_users"]

    expect(users.length).to eq(0)
    expect(total).to be_nil
  end
end
