# frozen_string_literal: true

RSpec.describe UserStatusController do
  describe '#set' do
    it 'requires user to be logged in' do
      put "/user-status.json", params: { description: "off to dentist" }
      expect(response.status).to eq(403)
    end

    it "returns 404 if the feature is disabled" do
      user = Fabricate(:user)
      sign_in(user)
      SiteSetting.enable_user_status = false

      put "/user-status.json", params: { description: "off" }

      expect(response.status).to eq(404)
    end

    describe 'feature is enabled and user is logged in' do
      fab!(:user) { Fabricate(:user) }

      before do
        sign_in(user)
        SiteSetting.enable_user_status = true
      end

      it 'the description parameter is mandatory' do
        put "/user-status.json", params: { emoji: "tooth" }
        expect(response.status).to eq(400)
      end

      it 'the emoji parameter is mandatory' do
        put "/user-status.json", params: { description: "off to dentist" }
        expect(response.status).to eq(400)
      end

      it "sets user status" do
        status = "off to dentist"
        status_emoji = "tooth"
        ends_at = DateTime.parse("2100-01-01 18:00")

        put "/user-status.json", params: {
          description: status,
          emoji: status_emoji,
          ends_at: ends_at
        }

        expect(response.status).to eq(200)
        expect(user.user_status.description).to eq(status)
        expect(user.user_status.emoji).to eq(status_emoji)
        expect(user.user_status.ends_at).to eq_time(ends_at)
      end

      it "following calls update status" do
        status = "off to dentist"
        status_emoji = "tooth"
        ends_at = DateTime.parse("2100-01-01 18:00")
        put "/user-status.json", params: {
          description: status,
          emoji: status_emoji,
          ends_at: ends_at
        }
        expect(response.status).to eq(200)

        user.reload
        expect(user.user_status.description).to eq(status)
        expect(user.user_status.emoji).to eq(status_emoji)
        expect(user.user_status.ends_at).to eq_time(ends_at)

        new_status = "surfing"
        new_status_emoji = "surfing_man"
        new_ends_at = DateTime.parse("2100-01-01 18:59")
        put "/user-status.json", params: {
          description: new_status,
          emoji: new_status_emoji,
          ends_at: new_ends_at
        }
        expect(response.status).to eq(200)

        user.reload
        expect(user.user_status.description).to eq(new_status)
        expect(user.user_status.emoji).to eq(new_status_emoji)
        expect(user.user_status.ends_at).to eq_time(new_ends_at)
      end

      it "publishes to message bus" do
        status = "off to dentist"
        emoji = "tooth"
        ends_at = "2100-01-01T18:00:00Z"

        messages = MessageBus.track_publish do
          put "/user-status.json", params: {
            description: status,
            emoji: emoji,
            ends_at: ends_at
          }
        end

        expect(messages.size).to eq(1)
        expect(messages[0].channel).to eq("/user-status")
        expect(messages[0].group_ids).to eq([Group::AUTO_GROUPS[:trust_level_0]])

        expect(messages[0].data[user.id][:description]).to eq(status)
        expect(messages[0].data[user.id][:emoji]).to eq(emoji)
        expect(messages[0].data[user.id][:ends_at]).to eq(ends_at)
      end
    end
  end

  describe '#clear' do
    it 'requires you to be logged in' do
      delete "/user-status.json"
      expect(response.status).to eq(403)
    end

    it "returns 404 if the feature is disabled" do
      user = Fabricate(:user)
      sign_in(user)
      SiteSetting.enable_user_status = false

      delete "/user-status.json"

      expect(response.status).to eq(404)
    end

    describe 'feature is enabled and user is logged in' do
      fab!(:user_status) { Fabricate(:user_status, description: "off to dentist") }
      fab!(:user) { Fabricate(:user, user_status: user_status) }

      before do
        sign_in(user)
        SiteSetting.enable_user_status = true
      end

      it "clears user status" do
        delete "/user-status.json"
        expect(response.status).to eq(200)

        user.reload
        expect(user.user_status).to be_nil
      end

      it "publishes to message bus" do
        messages = MessageBus.track_publish { delete "/user-status.json" }

        expect(messages.size).to eq(1)
        expect(messages[0].channel).to eq("/user-status")
        expect(messages[0].group_ids).to eq([Group::AUTO_GROUPS[:trust_level_0]])

        expect(messages[0].data[user.id]).to eq(nil)
      end
    end
  end
end
