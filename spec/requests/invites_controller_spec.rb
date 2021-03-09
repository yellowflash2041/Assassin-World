# frozen_string_literal: true

require 'rails_helper'

describe InvitesController do
  fab!(:admin) { Fabricate(:admin) }
  fab!(:trust_level_4) { Fabricate(:trust_level_4) }

  context 'show' do
    fab!(:invite) { Fabricate(:invite) }
    fab!(:user) { Fabricate(:coding_horror) }

    it 'does not work for logged in users' do
      sign_in(Fabricate(:user))
      get "/invites/#{invite.invite_key}"

      expect(response.status).to eq(200)
      body = response.body
      expect(CGI.unescapeHTML(body)).to include(I18n.t("login.already_logged_in"))
    end

    it "returns error if invite not found" do
      get "/invites/nopeNOPEnope"

      expect(response.status).to eq(200)

      body = response.body
      expect(body).to_not have_tag(:script, with: { src: '/assets/application.js' })
      expect(CGI.unescapeHTML(body)).to include(I18n.t('invite.not_found', base_url: Discourse.base_url))
    end

    it "returns error if invite expired" do
      invite.update(expires_at: 1.day.ago)

      get "/invites/#{invite.invite_key}"

      expect(response.status).to eq(200)

      body = response.body
      expect(body).to_not have_tag(:script, with: { src: '/assets/application.js' })
      expect(CGI.unescapeHTML(body)).to include(I18n.t('invite.expired', base_url: Discourse.base_url))
    end

    it "renders the accept invite page if invite exists" do
      get "/invites/#{invite.invite_key}"

      expect(response.status).to eq(200)

      body = response.body
      expect(body).to have_tag(:script, with: { src: '/assets/application.js' })
      expect(CGI.unescapeHTML(body)).to_not include(I18n.t('invite.not_found_template', site_name: SiteSetting.title, base_url: Discourse.base_url))
    end

    it "returns error if invite has already been redeemed" do
      Fabricate(:invited_user, invite: invite, user: Fabricate(:user))
      get "/invites/#{invite.invite_key}"

      expect(response.status).to eq(200)

      body = response.body
      expect(body).to_not have_tag(:script, with: { src: '/assets/application.js' })
      expect(CGI.unescapeHTML(body)).to include(I18n.t('invite.not_found_template', site_name: SiteSetting.title, base_url: Discourse.base_url))
    end
  end

  context '#destroy' do
    it 'requires you to be logged in' do
      delete "/invites.json",
        params: { email: 'jake@adventuretime.ooo' }
      expect(response.status).to eq(403)
    end

    context 'while logged in' do
      let!(:user) { sign_in(Fabricate(:user))      }
      let!(:invite) { Fabricate(:invite, invited_by: user) }
      fab!(:another_invite) { Fabricate(:invite, email: 'anotheremail@address.com') }

      it 'raises an error when the id is missing' do
        delete "/invites.json"
        expect(response.status).to eq(400)
      end

      it "raises an error when the id cannot be found" do
        delete "/invites.json", params: { id: 848 }
        expect(response.status).to eq(400)
      end

      it 'raises an error when the invite is not yours' do
        delete "/invites.json", params: { id: another_invite.id }
        expect(response.status).to eq(400)
      end

      it "destroys the invite" do
        delete "/invites.json", params: { id: invite.id }

        expect(response.status).to eq(200)

        invite.reload
        expect(invite.trashed?).to be_truthy
      end
    end
  end

  context '#create' do
    it 'requires you to be logged in' do
      post "/invites.json", params: { email: 'jake@adventuretime.ooo' }
      expect(response.status).to eq(403)
    end

    context 'while logged in' do
      let(:email) { 'jake@adventuretime.ooo' }

      it "fails if you can't invite to the forum" do
        sign_in(Fabricate(:user))
        post "/invites.json", params: { email: email }
        expect(response).to be_forbidden
      end

      it "fails for normal user if invite email already exists" do
        user = sign_in(trust_level_4)
        invite = Invite.generate(user, email: "invite@example.com")
        post "/invites.json", params: { email: invite.email }
        expect(response.status).to eq(422)
        expect(response.parsed_body["failed"]).to be_present
      end

      it "allows admins to invite to groups" do
        group = Fabricate(:group)
        sign_in(admin)
        post "/invites.json", params: { email: email, group_ids: [group.id] }
        expect(response.status).to eq(200)
        expect(Invite.find_by(email: email).invited_groups.count).to eq(1)
      end

      it 'allows group owners to invite to groups' do
        group = Fabricate(:group)
        user = sign_in(Fabricate(:user))
        user.update!(trust_level: TrustLevel[2])
        group.add_owner(user)

        post "/invites.json", params: { email: email, group_ids: [group.id] }

        expect(response.status).to eq(200)
        expect(Invite.find_by(email: email).invited_groups.count).to eq(1)
      end

      it "does not allow admins to send multiple invites to same email" do
        user = sign_in(admin)
        invite = Invite.generate(user, email: "invite@example.com")
        post "/invites.json", params: { email: invite.email }
        expect(response.status).to eq(422)
      end

      it "responds with error message in case of validation failure" do
        sign_in(admin)
        post "/invites.json", params: { email: "test@mailinator.com" }
        expect(response.status).to eq(422)
        expect(response.parsed_body["errors"]).to be_present
      end
    end

    describe 'single use invite link' do
      it 'requires you to be logged in' do
        post "/invites.json", params: {
          email: 'jake@adventuretime.ooo', skip_email: true
        }
        expect(response.status).to eq(403)
      end

      context 'while logged in' do
        let(:email) { 'jake@adventuretime.ooo' }

        it "fails if you can't invite to the forum" do
          sign_in(Fabricate(:user))
          post "/invites.json", params: { email: email, skip_email: true }
          expect(response.status).to eq(403)
        end

        it "fails for normal user if invite email already exists" do
          user = sign_in(trust_level_4)
          invite = Invite.generate(user, email: "invite@example.com")

          post "/invites.json", params: { email: invite.email, skip_email: true }
          expect(response.status).to eq(422)
        end

        it "fails when topic_id is invalid" do
          sign_in(trust_level_4)

          post "/invites.json", params: { email: email, skip_email: true, topic_id: -9999 }
          expect(response.status).to eq(400)
        end

        it "verifies that inviter is authorized to invite new user to a group-private topic" do
          group = Fabricate(:group)
          private_category = Fabricate(:private_category, group: group)
          group_private_topic = Fabricate(:topic, category: private_category)
          sign_in(trust_level_4)

          post "/invites.json", params: {
            email: email, skip_email: true, topic_id: group_private_topic.id
          }

          expect(response.status).to eq(403)
        end

        it "allows admins to invite to groups" do
          group = Fabricate(:group)
          sign_in(admin)

          post "/invites.json", params: {
            email: email, skip_email: true, group_ids: [group.id]
          }

          expect(response.status).to eq(200)
          expect(Invite.find_by(email: email).invited_groups.count).to eq(1)
        end

        it "allows multiple group invite" do
          Fabricate(:group, name: "security")
          Fabricate(:group, name: "support")
          sign_in(admin)

          post "/invites.json", params: {
            email: email, skip_email: true, group_names: "security,support"
          }

          expect(response.status).to eq(200)
          expect(Invite.find_by(email: email).invited_groups.count).to eq(2)
        end
      end
    end

    describe 'multiple use invite link' do
      it 'requires you to be logged in' do
        post "/invites.json", params: {
          max_redemptions_allowed: 5
        }
        expect(response).to be_forbidden
      end

      context 'while logged in' do
        it "allows staff to invite to groups" do
          moderator = Fabricate(:moderator)
          sign_in(moderator)
          group = Fabricate(:group)
          group.add_owner(moderator)

          post "/invites.json", params: {
            max_redemptions_allowed: 5,
            group_ids: [group.id]
          }

          expect(response.status).to eq(200)
          expect(Invite.last.invited_groups.count).to eq(1)
        end

        it "allows multiple group invite" do
          Fabricate(:group, name: "security")
          Fabricate(:group, name: "support")
          sign_in(admin)

          post "/invites.json", params: {
            max_redemptions_allowed: 5,
            group_names: "security,support"
          }

          expect(response.status).to eq(200)
          expect(Invite.last.invited_groups.count).to eq(2)
        end
      end
    end
  end

  context '#update' do
    fab!(:invite) { Fabricate(:invite, invited_by: admin, email: 'test@example.com') }

    before do
      sign_in(admin)
      RateLimiter.enable
    end

    after do
      RateLimiter.disable
    end

    it 'updating email address resends invite email' do
      put "/invites/#{invite.id}", params: { email: 'test2@example.com' }

      expect(response.status).to eq(200)
      expect(Jobs::InviteEmail.jobs.size).to eq(1)
    end

    it 'updating does not resend invite email' do
      put "/invites/#{invite.id}", params: { custom_message: "new message" }

      expect(response.status).to eq(200)
      expect(invite.reload.custom_message).to eq("new message")
      expect(Jobs::InviteEmail.jobs.size).to eq(0)
    end

    it 'can send invite email' do
      user = Fabricate(:user, trust_level: SiteSetting.min_trust_level_to_allow_invite)
      invite = Fabricate(:invite, invited_by: user, email: 'test@example.com')

      sign_in(user)
      RateLimiter.enable

      expect { put "/invites/#{invite.id}", params: { send_email: true } }
        .to change { RateLimiter.new(user, "resend-invite-per-hour", 10, 1.hour).remaining }.by(-1)

      expect(response.status).to eq(200)
      expect(Jobs::InviteEmail.jobs.size).to eq(1)
    end
  end

  context '#perform_accept_invitation' do
    context 'with an invalid invite id' do
      it "redirects to the root and doesn't change the session" do
        put "/invites/show/doesntexist.json"
        expect(response.status).to eq(404)
        expect(response.parsed_body["message"]).to eq(I18n.t('invite.not_found_json'))
        expect(session[:current_user_id]).to be_blank
      end
    end

    context 'with an invalid invite record' do
      let(:invite) { Fabricate(:invite) }
      it "responds with error message" do
        invite.update_attribute(:email, "John Doe <john.doe@example.com>")
        put "/invites/show/#{invite.invite_key}.json"
        expect(response.status).to eq(412)
        expect(response.parsed_body["message"]).to eq(I18n.t('invite.error_message'))
        expect(session[:current_user_id]).to be_blank
      end
    end

    context 'with a deleted invite' do
      fab!(:topic) { Fabricate(:topic) }
      let(:invite) { Invite.generate(topic.user, email: "iceking@adventuretime.ooo", topic: topic) }

      before do
        invite.destroy!
      end

      it "redirects to the root" do
        put "/invites/show/#{invite.invite_key}.json"

        expect(response.status).to eq(404)
        expect(response.parsed_body["message"]).to eq(I18n.t('invite.not_found_json'))
        expect(session[:current_user_id]).to be_blank
      end
    end

    context 'with an expired invite' do
      fab!(:invite_link) { Fabricate(:invite, email: nil, max_redemptions_allowed: 5, expires_at: 1.day.ago, emailed_status: Invite.emailed_status_types[:not_required]) }

      it "response is not successful" do
        put "/invites/show/#{invite_link.invite_key}.json", params: { email: "foobar@example.com" }

        expect(response.status).to eq(404)
        expect(response.parsed_body["message"]).to eq(I18n.t('invite.not_found_json'))
        expect(session[:current_user_id]).to be_blank
      end
    end

    context 'with a valid invite id' do
      fab!(:topic) { Fabricate(:topic) }
      let(:invite) { Invite.generate(topic.user, email: "iceking@adventuretime.ooo", topic: topic) }

      it 'redeems the invite' do
        put "/invites/show/#{invite.invite_key}.json"
        invite.reload
        expect(invite.redeemed?).to be_truthy
      end

      it 'returns the right response when local login is disabled and no external auth is configured' do
        SiteSetting.enable_local_logins = false

        put "/invites/show/#{invite.invite_key}.json"

        expect(response.status).to eq(404)
      end

      it 'returns the right response when DiscourseConnect is enabled' do
        invite
        SiteSetting.discourse_connect_url = "https://www.example.com/sso"
        SiteSetting.enable_discourse_connect = true

        put "/invites/show/#{invite.invite_key}.json"

        expect(response.status).to eq(404)
      end

      describe 'with authentication session' do
        let(:authenticated_email) { "foobar@example.com" }

        before do
          OmniAuth.config.test_mode = true

          OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
            provider: 'google_oauth2',
            uid: '12345',
            info: OmniAuth::AuthHash::InfoHash.new(
              email: authenticated_email,
              name: 'First Last'
            ),
            extra: {
              raw_info: OmniAuth::AuthHash.new(
                email_verified: true,
                email: authenticated_email,
                family_name: "Last",
                given_name: "First",
                gender: "male",
                name: "First Last",
              )
            },
          )

          Rails.application.env_config["omniauth.auth"] = OmniAuth.config.mock_auth[:google_oauth2]
          SiteSetting.enable_google_oauth2_logins = true

          get "/auth/google_oauth2/callback.json"
          expect(response.status).to eq(302)
        end

        after do
          Rails.application.env_config["omniauth.auth"] = OmniAuth.config.mock_auth[:google_oauth2] = nil
          OmniAuth.config.test_mode = false
        end

        it 'should associate the invited user with authenticator records' do
          invite.update!(email: authenticated_email)
          SiteSetting.auth_overrides_name = true

          expect do
            put "/invites/show/#{invite.invite_key}.json",
              params: { name: 'somename' }

            expect(response.status).to eq(200)
          end.to change { User.with_email(authenticated_email).exists? }.to(true)

          user = User.find_by_email(authenticated_email)

          expect(user.name).to eq('First Last')

          expect(user.user_associated_accounts.first.provider_name)
            .to eq("google_oauth2")
        end

        it 'returns the right response even if local logins has been disabled' do
          SiteSetting.enable_local_logins = false

          invite.update!(email: authenticated_email)

          put "/invites/show/#{invite.invite_key}.json"

          expect(response.status).to eq(200)
        end

        it 'returns the right response if authenticated email does not match invite email' do
          put "/invites/show/#{invite.invite_key}.json"

          expect(response.status).to eq(412)
        end
      end

      context 'when redeem returns a user' do
        fab!(:user) { Fabricate(:coding_horror) }

        context 'success' do
          it 'logs in the user' do
            events = DiscourseEvent.track_events do
              put "/invites/show/#{invite.invite_key}.json"
            end

            expect(events.map { |event| event[:event_name] }).to include(
              :user_logged_in, :user_first_logged_in
            )
            invite.reload
            expect(response.status).to eq(200)
            expect(session[:current_user_id]).to eq(invite.invited_users.first.user_id)
            expect(invite.redeemed?).to be_truthy
            user = User.find(invite.invited_users.first.user_id)
            expect(user.ip_address).to be_present
            expect(user.registration_ip_address).to be_present
          end

          it 'redirects to the first topic the user was invited to' do
            put "/invites/show/#{invite.invite_key}.json"
            expect(response.status).to eq(200)
            expect(response.parsed_body["redirect_to"]).to eq(topic.relative_url)
          end

          context "if a timezone guess is provided" do
            it "sets the timezone of the user in user_options" do
              put "/invites/show/#{invite.invite_key}.json", params: { timezone: "Australia/Melbourne" }
              expect(response.status).to eq(200)
              invite.reload
              user = User.find(invite.invited_users.first.user_id)
              expect(user.user_option.timezone).to eq("Australia/Melbourne")
            end
          end
        end

        context 'failure' do
          it "doesn't log in the user if there's a validation error" do
            put "/invites/show/#{invite.invite_key}.json", params: { password: "password" }
            expect(response.status).to eq(412)
            expect(response.parsed_body["errors"]["password"]).to be_present
          end
        end

        context '.post_process_invite' do
          it 'sends a welcome message if set' do
            user.send_welcome_message = true
            put "/invites/show/#{invite.invite_key}.json"
            expect(response.status).to eq(200)

            expect(Jobs::SendSystemMessage.jobs.size).to eq(1)
          end

          it 'refreshes automatic groups if staff' do
            topic.user.grant_admin!
            invite.update!(moderator: true)

            put "/invites/show/#{invite.invite_key}.json"
            expect(response.status).to eq(200)

            expect(invite.invited_users.first.user.groups.pluck(:name)).to contain_exactly("moderators", "staff")
          end

          context "without password" do
            it "sends password reset email" do
              put "/invites/show/#{invite.invite_key}.json"
              expect(response.status).to eq(200)

              expect(Jobs::InvitePasswordInstructionsEmail.jobs.size).to eq(1)
              expect(Jobs::CriticalUserEmail.jobs.size).to eq(0)
            end
          end

          context "with password" do
            context "user was invited via email" do
              before { invite.update_column(:emailed_status, Invite.emailed_status_types[:pending]) }

              it "doesn't send an activation email and activates the user" do
                expect do
                  put "/invites/show/#{invite.invite_key}.json", params: { password: "verystrongpassword" }
                end.to change { UserAuthToken.count }.by(1)

                expect(response.status).to eq(200)

                expect(Jobs::InvitePasswordInstructionsEmail.jobs.size).to eq(0)
                expect(Jobs::CriticalUserEmail.jobs.size).to eq(0)

                invited_user = User.find_by_email(invite.email)
                expect(invited_user.active).to eq(true)
                expect(invited_user.email_confirmed?).to eq(true)
              end
            end

            context "user was invited via link" do
              before { invite.update_column(:emailed_status, Invite.emailed_status_types[:not_required]) }

              it "sends an activation email and doesn't activate the user" do
                expect do
                  put "/invites/show/#{invite.invite_key}.json", params: { password: "verystrongpassword" }
                end.not_to change { UserAuthToken.count }

                expect(response.status).to eq(200)
                expect(response.parsed_body["message"]).to eq(I18n.t("invite.confirm_email"))

                invited_user = User.find_by_email(invite.email)
                expect(invited_user.active).to eq(false)
                expect(invited_user.email_confirmed?).to eq(false)

                expect(Jobs::InvitePasswordInstructionsEmail.jobs.size).to eq(0)
                expect(Jobs::CriticalUserEmail.jobs.size).to eq(1)

                tokens = EmailToken.where(user_id: invited_user.id, confirmed: false, expired: false).pluck(:token)
                expect(tokens.size).to eq(1)

                job_args = Jobs::CriticalUserEmail.jobs.first["args"].first
                expect(job_args["type"]).to eq("signup")
                expect(job_args["user_id"]).to eq(invited_user.id)
                expect(job_args["email_token"]).to eq(tokens.first)
              end
            end
          end
        end
      end
    end

    context 'with multiple use invite link' do
      fab!(:invite_link) { Fabricate(:invite, email: nil, max_redemptions_allowed: 5, expires_at: 1.month.from_now, emailed_status: Invite.emailed_status_types[:not_required]) }

      it "sends an activation email and doesn't activate the user" do
        expect do
          put "/invites/show/#{invite_link.invite_key}.json", params: { email: "foobar@example.com", password: "verystrongpassword" }
        end.not_to change { UserAuthToken.count }

        expect(response.status).to eq(200)
        expect(response.parsed_body["message"]).to eq(I18n.t("invite.confirm_email"))

        invite_link.reload
        expect(invite_link.redemption_count).to eq(1)

        invited_user = User.find_by_email("foobar@example.com")
        expect(invited_user.active).to eq(false)
        expect(invited_user.email_confirmed?).to eq(false)

        expect(Jobs::InvitePasswordInstructionsEmail.jobs.size).to eq(0)
        expect(Jobs::CriticalUserEmail.jobs.size).to eq(1)

        tokens = EmailToken.where(user_id: invited_user.id, confirmed: false, expired: false).pluck(:token)
        expect(tokens.size).to eq(1)

        job_args = Jobs::CriticalUserEmail.jobs.first["args"].first
        expect(job_args["type"]).to eq("signup")
        expect(job_args["user_id"]).to eq(invited_user.id)
        expect(job_args["email_token"]).to eq(tokens.first)
      end
    end

    context 'new registrations are disabled' do
      fab!(:topic) { Fabricate(:topic) }

      let(:invite) { Invite.generate(topic.user, email: "iceking@adventuretime.ooo", topic: topic) }

      before { SiteSetting.allow_new_registrations = false }

      it "doesn't redeem the invite" do
        put "/invites/show/#{invite.invite_key}.json"
        expect(response.status).to eq(200)
        invite.reload
        expect(invite.invited_users).to be_blank
        expect(invite.redeemed?).to be_falsey
        expect(response.body).to include(I18n.t("login.new_registrations_disabled"))
      end
    end

    context 'user is already logged in' do
      fab!(:topic) { Fabricate(:topic) }

      let(:invite) { Invite.generate(topic.user, email: "iceking@adventuretime.ooo", topic: topic) }

      let!(:user) { sign_in(Fabricate(:user)) }

      it "doesn't redeem the invite" do
        put "/invites/show/#{invite.invite_key}.json", params: { id: invite.invite_key }
        expect(response.status).to eq(200)
        invite.reload
        expect(invite.invited_users).to be_blank
        expect(invite.redeemed?).to be_falsey
        expect(response.body).to include(I18n.t("login.already_logged_in", current_user: user.username))
      end
    end
  end

  context "#destroy_all" do
    it 'removes all expired invites sent by a user' do
      SiteSetting.invite_expiry_days = 1

      user = Fabricate(:admin)
      invite_1 = Fabricate(:invite, invited_by: user)
      invite_2 = Fabricate(:invite, invited_by: user)
      expired_invite = Fabricate(:invite, invited_by: user)
      expired_invite.update!(expires_at: 2.days.ago)

      sign_in(user)
      post "/invites/destroy-all-expired"

      expect(response.status).to eq(200)
      expect(invite_1.reload.deleted_at).to eq(nil)
      expect(invite_2.reload.deleted_at).to eq(nil)
      expect(expired_invite.reload.deleted_at).to be_present
    end
  end

  context '#resend_invite' do
    it 'requires you to be logged in' do
      post "/invites/reinvite.json", params: { email: 'first_name@example.com' }
      expect(response.status).to eq(403)
    end

    context 'while logged in' do
      let!(:user) { sign_in(Fabricate(:user)) }
      let!(:invite) { Fabricate(:invite, invited_by: user) }
      fab!(:another_invite) { Fabricate(:invite, email: 'last_name@example.com') }

      it 'raises an error when the email is missing' do
        post "/invites/reinvite.json"
        expect(response.status).to eq(400)
      end

      it "raises an error when the email cannot be found" do
        post "/invites/reinvite.json", params: { email: 'first_name@example.com' }
        expect(response.status).to eq(400)
      end

      it 'raises an error when the invite is not yours' do
        post "/invites/reinvite.json", params: { email: another_invite.email }
        expect(response.status).to eq(400)
      end

      it "resends the invite" do
        post "/invites/reinvite.json", params: { email: invite.email }
        expect(response.status).to eq(200)
        expect(Jobs::InviteEmail.jobs.size).to eq(1)
      end
    end
  end

  context '#resend_all_invites' do
    it 'resends all non-redeemed invites by a user' do
      SiteSetting.invite_expiry_days = 30

      user = Fabricate(:admin)
      new_invite = Fabricate(:invite, invited_by: user)
      expired_invite = Fabricate(:invite, invited_by: user)
      expired_invite.update!(expires_at: 2.days.ago)
      redeemed_invite = Fabricate(:invite, invited_by: user)
      Fabricate(:invited_user, invite: redeemed_invite, user: Fabricate(:user))
      redeemed_invite.update!(expires_at: 5.days.ago)

      sign_in(user)
      post "/invites/reinvite-all"

      expect(response.status).to eq(200)
      expect(new_invite.reload.expires_at.to_date).to eq(30.days.from_now.to_date)
      expect(expired_invite.reload.expires_at.to_date).to eq(30.days.from_now.to_date)
      expect(redeemed_invite.reload.expires_at.to_date).to eq(5.days.ago.to_date)
    end
  end

  context '#upload_csv' do
    it 'requires you to be logged in' do
      post "/invites/upload_csv.json"
      expect(response.status).to eq(403)
    end

    context 'while logged in' do
      let(:csv_file) { File.new("#{Rails.root}/spec/fixtures/csv/discourse.csv") }

      let(:file) do
        Rack::Test::UploadedFile.new(File.open(csv_file))
      end

      let(:filename) { 'discourse.csv' }

      it "fails if you can't bulk invite to the forum" do
        sign_in(Fabricate(:user))
        post "/invites/upload_csv.json", params: { file: file, name: filename }
        expect(response.status).to eq(403)
      end

      it "allows admin to bulk invite" do
        sign_in(admin)
        post "/invites/upload_csv.json", params: { file: file, name: filename }
        expect(response.status).to eq(200)
        expect(Jobs::BulkInvite.jobs.size).to eq(1)
      end

      it "sends limited invites at a time" do
        SiteSetting.max_bulk_invites = 3
        sign_in(admin)
        post "/invites/upload_csv.json", params: { file: file, name: filename }

        expect(response.status).to eq(422)
        expect(Jobs::BulkInvite.jobs.size).to eq(1)
        expect(response.parsed_body["errors"][0]).to eq(I18n.t("bulk_invite.max_rows", max_bulk_invites: SiteSetting.max_bulk_invites))
      end
    end
  end
end
