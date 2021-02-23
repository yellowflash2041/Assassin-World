# frozen_string_literal: true
require 'swagger_helper'

describe 'users' do

  let(:'Api-Key') { Fabricate(:api_key).key }
  let(:'Api-Username') { 'system' }
  let(:admin) { Fabricate(:admin) }

  before do
    SiteSetting.tagging_enabled = true
    Jobs.run_immediately!
    sign_in(admin)
  end

  path '/users.json' do

    post 'Creates a user' do
      tags 'Users'
      consumes 'application/json'
      parameter name: 'Api-Key', in: :header, type: :string, required: true
      parameter name: 'Api-Username', in: :header, type: :string, required: true
      parameter name: :user_body, in: :body, schema: {
        type: :object,
        properties: {
          "name": { type: :string },
          "email": { type: :string },
          "password": { type: :string },
          "username": { type: :string },
          "active": { type: :boolean },
          "approved": { type: :boolean },
          "user_fields[1]": { type: :string },
        },
        required: ['name', 'email', 'password', 'username']
      }

      produces 'application/json'
      response '200', 'user created' do
        schema type: :object, properties: {
          success: { type: :boolean },
          active: { type: :boolean },
          message: { type: :string },
          user_id: { type: :integer },
        }

        let(:user_body) { {
          name: 'user',
          username: 'user1',
          email: 'user1@example.com',
          password: '13498428e9597cab689b468ebc0a5d33',
          active: true
        } }
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['success']).to eq(true)
          expect(data['active']).to eq(true)
        end
      end
    end

  end

  path '/u/{username}.json' do

    get 'Get a single user by username' do
      tags 'Users'
      consumes 'application/json'
      parameter name: 'Api-Key', in: :header, type: :string, required: true
      parameter name: 'Api-Username', in: :header, type: :string, required: true
      parameter name: :username, in: :path, type: :string, required: true

      produces 'application/json'
      response '200', 'user response' do
        schema '$ref' => '#/components/schemas/user_response'

        let(:username) { 'system' }
        run_test!
      end
    end
  end

  path '/u/by-external/{external_id}.json' do

    get 'Get a user by external_id' do
      tags 'Users'
      consumes 'application/json'
      parameter name: 'Api-Key', in: :header, type: :string, required: true
      parameter name: 'Api-Username', in: :header, type: :string, required: true
      parameter name: :external_id, in: :path, type: :string, required: true

      produces 'application/json'
      response '200', 'user response' do
        schema '$ref' => '#/components/schemas/user_response'

        let(:user) { Fabricate(:user) }
        let(:external_id) { '1' }

        before do
          SiteSetting.discourse_connect_url = 'http://someurl.com'
          SiteSetting.enable_discourse_connect = true
          user.create_single_sign_on_record(external_id: '1', last_payload: '')
        end

        run_test!
      end
    end
  end

  path '/u/by-external/{provider}/{external_id}.json' do

    get 'Get a user by identity provider external ID' do
      tags 'Users'
      consumes 'application/json'
      parameter name: 'Api-Key', in: :header, type: :string, required: true
      parameter name: 'Api-Username', in: :header, type: :string, required: true
      parameter name: :provider,
                in: :path,
                type: :string,
                required: true,
                description: "Authentication provider name. Can be found in the provider callback URL: `/auth/{provider}/callback`"
      parameter name: :external_id, in: :path, type: :string, required: true

      produces 'application/json'
      response '200', 'user response' do
        schema '$ref' => '#/components/schemas/user_response'

        let(:user) { Fabricate(:user) }
        let(:provider) { 'google_oauth2' }
        let(:external_id) { 'myuid' }

        before do
          SiteSetting.enable_google_oauth2_logins = true
          UserAssociatedAccount.create!(user: user, provider_uid: 'myuid', provider_name: 'google_oauth2')
        end

        run_test!
      end
    end
  end

  path '/u/{username}/preferences/avatar/pick.json' do

    put 'Update avatar' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_update_avatar_request')

      parameter name: :username, in: :path, type: :string, required: true
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'avatar updated' do
        expected_response_schema = load_spec_schema('success_ok_response')

        let(:user) { Fabricate(:user) }
        let(:username) { user.username }
        let(:upload) { Fabricate(:upload, user: user) }
        let(:params) { { 'upload_id' => upload.id, 'type' => 'uploaded' } }

        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end

  end

  path '/u/{username}/preferences/email.json' do

    put 'Update email' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_update_email_request')

      parameter name: :username, in: :path, type: :string, required: true
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'email updated' do

        let(:user) { Fabricate(:user) }
        let(:username) { user.username }
        let(:params) { { 'email' => "test@example.com" } }

        expected_response_schema = nil

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end

  end

  path '/directory_items.json' do

    get 'Get a public list of users' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :period,
                in: :query,
                schema: {
                  type: :string,
                  enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all']
                },
                required: true
      parameter name: :order,
                in: :query,
                schema: {
                  type: :string,
                  enum: [
                    'likes_received',
                    'likes_given',
                    'topic_count',
                    'post_count',
                    'topics_entered',
                    'posts_read',
                    'days_visited'
                  ]
                },
                required: true
      parameter name: :asc,
                in: :query,
                schema: {
                   type: :string,
                   enum: ['true']
                 }
      parameter name: :page, in: :query, type: :integer

      produces 'application/json'
      response '200', 'directory items response' do

        let(:period) { 'weekly' }
        let(:order) { 'likes_received' }
        let(:asc) { 'true' }
        let(:page) { 0 }

        expected_response_schema = load_spec_schema('users_public_list_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end

  end

  path '/admin/users/{id}.json' do

    get 'Get a user by id' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :id, in: :path, type: :integer, required: true

      produces 'application/json'
      response '200', 'response' do

        let(:id) { Fabricate(:user).id }

        expected_response_schema = load_spec_schema('admin_user_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end

    delete 'Delete a user' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_delete_request')

      parameter name: :id, in: :path, type: :integer, required: true
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'response' do

        let(:id) { Fabricate(:user).id }
        let(:params) { {
          'delete_posts' => true,
          'block_email' => false,
          'block_urls' => false,
          'block_ip' => false
        } }

        expected_response_schema = load_spec_schema('user_delete_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end

  end

  path '/admin/users/{id}/suspend.json' do
    put 'Suspend a user' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_suspend_request')

      parameter name: :id, in: :path, type: :integer, required: true
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'response' do

        let(:id) { Fabricate(:user).id }
        let(:params) { {
          'suspend_until' => '2121-02-22',
          'reason' => 'inactivity'
        } }

        expected_response_schema = load_spec_schema('user_suspend_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/admin/users/{id}/log_out.json' do

    post 'Log a user out' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :id, in: :path, type: :integer, required: true

      produces 'application/json'
      response '200', 'response' do

        let(:id) { Fabricate(:user).id }

        expected_response_schema = load_spec_schema('success_ok_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/user_avatar/{username}/refresh_gravatar.json' do

    before do
      stub_request(:get, /https:\/\/www.gravatar.com\/avatar\/\w+.png\?d=404&reset_cache=\S+&s=360/).
        with(
          headers: {
               'Accept' => '*/*',
               'Accept-Encoding' => 'gzip',
               'Host' => 'www.gravatar.com'
          }).
        to_return(status: 200, body: "", headers: {})
    end

    post 'Refresh gravatar' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :username, in: :path, type: :string, required: true

      produces 'application/json'
      response '200', 'response' do

        let(:user) { Fabricate(:user) }
        let(:username) { user.username }

        expected_response_schema = load_spec_schema('user_refresh_gravatar_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/admin/users/list/{flag}.json' do

    get 'Get a list of users' do
      tags 'Users', 'Admin'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :flag,
                in: :path,
                schema: {
                  type: :string,
                  enum: ['active', 'new', 'staff', 'suspended', 'blocked', 'suspect']
                },
                required: true
      parameter name: :order,
                in: :query,
                schema: {
                  type: :string,
                  enum: [
                    'created',
                    'last_emailed',
                    'seen',
                    'username',
                    'email',
                    'trust_level',
                    'days_visited',
                    'posts_read',
                    'topics_viewed',
                    'posts',
                    'read_time'
                  ]
                }
      parameter name: :asc,
                in: :query,
                schema: {
                   type: :string,
                   enum: ['true']
                 }
      parameter name: :page, in: :query, type: :integer
      parameter name: :show_emails, in: :query, type: :boolean

      produces 'application/json'
      response '200', 'response' do

        let(:flag) { 'active' }
        let(:order) { 'created' }
        let(:asc) { 'true' }
        let(:page) { 0 }
        let(:show_emails) { false }

        expected_response_schema = load_spec_schema('admin_user_list_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/user_actions.json' do

    get 'Get a list of user actions' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = nil

      parameter name: :offset, in: :query, type: :integer, required: true
      parameter name: :username, in: :query, type: :string, required: true
      parameter name: :filter, in: :query, type: :string, required: true

      produces 'application/json'
      response '200', 'response' do

        let(:offset) { 0 }
        let(:username) { Fabricate(:user).username }
        let(:filter) { '4,5' }

        expected_response_schema = load_spec_schema('user_actions_response')
        schema(expected_response_schema)

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/session/forgot_password.json' do
    post 'Send password reset email' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_password_reset_request')
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'success response' do
        expected_response_schema = load_spec_schema('user_password_reset_response')
        schema expected_response_schema

        let(:user) { Fabricate(:user) }
        let(:params) { { 'login' => user.username } }

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

  path '/users/password-reset/{token}.json' do
    put 'Change password' do
      tags 'Users'
      consumes 'application/json'
      expected_request_schema = load_spec_schema('user_password_change_request')
      parameter name: :token, in: :path, type: :string, required: true
      parameter name: :params, in: :body, schema: expected_request_schema

      produces 'application/json'
      response '200', 'success response' do
        expected_response_schema = nil

        let(:user) { Fabricate(:user) }
        let(:token) { user.email_tokens.create(email: user.email).token }
        let(:params) { {
          'username' => user.username,
          'password' => 'NH8QYbxYS5Zv5qEFzA4jULvM'
        } }

        it_behaves_like "a JSON endpoint", 200 do
          let(:expected_response_schema) { expected_response_schema }
          let(:expected_request_schema) { expected_request_schema }
        end
      end
    end
  end

end
