require 'rails_helper'

describe UserAuthToken do

  it "can remove old expired tokens" do

    SiteSetting.verbose_auth_token_logging = true

    freeze_time Time.zone.now
    SiteSetting.maximum_session_age = 1

    user = Fabricate(:user)
    token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent 2",
                                    client_ip: "1.1.2.3")

    freeze_time 1.hour.from_now
    UserAuthToken.cleanup!

    expect(UserAuthToken.where(id: token.id).count).to eq(1)

    freeze_time 1.second.from_now
    UserAuthToken.cleanup!

    expect(UserAuthToken.where(id: token.id).count).to eq(1)

    freeze_time UserAuthToken::ROTATE_TIME.from_now
    UserAuthToken.cleanup!

    expect(UserAuthToken.where(id: token.id).count).to eq(0)

  end

  it "can lookup both hashed and unhashed" do
    user = Fabricate(:user)

    token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent 2",
                                    client_ip: "1.1.2.3")

    lookup_token = UserAuthToken.lookup(token.unhashed_auth_token)

    expect(user.id).to eq(lookup_token.user.id)

    lookup_token = UserAuthToken.lookup(token.auth_token)

    expect(lookup_token).to eq(nil)

    token.update_columns(legacy: true)

    lookup_token = UserAuthToken.lookup(token.auth_token)

    expect(user.id).to eq(lookup_token.user.id)
  end

  it "can validate token was seen at lookup time" do

    user = Fabricate(:user)

    user_token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent 2",
                                    client_ip: "1.1.2.3")

    expect(user_token.auth_token_seen).to eq(false)

    UserAuthToken.lookup(user_token.unhashed_auth_token, seen: true)

    user_token.reload
    expect(user_token.auth_token_seen).to eq(true)

  end

  it "can rotate with no params maintaining data" do

    user = Fabricate(:user)

    user_token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent 2",
                                    client_ip: "1.1.2.3")

    user_token.update_columns(auth_token_seen: true)
    expect(user_token.rotate!).to eq(true)
    user_token.reload
    expect(user_token.client_ip.to_s).to eq("1.1.2.3")
    expect(user_token.user_agent).to eq("some user agent 2")
  end

  it "can properly rotate tokens" do

    user = Fabricate(:user)

    user_token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent 2",
                                    client_ip: "1.1.2.3")

    prev_auth_token = user_token.auth_token
    unhashed_prev = user_token.unhashed_auth_token

    rotated = user_token.rotate!(user_agent: "a new user agent", client_ip: "1.1.2.4")
    expect(rotated).to eq(false)

    user_token.update_columns(auth_token_seen: true)

    rotated = user_token.rotate!(user_agent: "a new user agent", client_ip: "1.1.2.4")
    expect(rotated).to eq(true)

    user_token.reload

    expect(user_token.rotated_at).to be_within(5.second).of(Time.zone.now)
    expect(user_token.client_ip).to eq("1.1.2.4")
    expect(user_token.user_agent).to eq("a new user agent")
    expect(user_token.auth_token_seen).to eq(false)
    expect(user_token.prev_auth_token).to eq(prev_auth_token)

    # ability to auth using an old token
    looked_up = UserAuthToken.lookup(unhashed_prev)
    expect(looked_up.id).to eq(user_token.id)

    freeze_time(2.minute.from_now) do
      looked_up = UserAuthToken.lookup(unhashed_prev)
      expect(looked_up).to eq(nil)
    end
  end

  it "can correctly log auth tokens" do
    SiteSetting.verbose_auth_token_logging = true

    user = Fabricate(:user)

    token = UserAuthToken.generate!(user_id: user.id,
                                    user_agent: "some user agent",
                                    client_ip: "1.1.2.3")

    expect(UserAuthTokenLog.where(
      action: 'generate',
      user_id: user.id,
      user_agent: "some user agent",
      client_ip: "1.1.2.3",
      user_auth_token_id: token.id,
    ).count).to eq(1)

    UserAuthToken.lookup(token.unhashed_auth_token,
      seen: true,
      user_agent: "something diff",
      client_ip: "1.2.3.3"
    )

    UserAuthToken.lookup(token.unhashed_auth_token,
      seen: true,
      user_agent: "something diff2",
      client_ip: "1.2.3.3"
    )

    expect(UserAuthTokenLog.where(
      action: "seen token",
      user_id: user.id,
      auth_token: token.auth_token,
      client_ip: "1.2.3.3",
      user_auth_token_id: token.id
    ).count).to eq(1)

    fake_token = SecureRandom.hex
    UserAuthToken.lookup(fake_token, seen: true, user_agent: "bob", client_ip: "127.0.0.1")

    expect(UserAuthTokenLog.where(
      action: "miss token",
      auth_token: UserAuthToken.hash_token(fake_token),
      user_agent: "bob",
      client_ip: "127.0.0.1"
    ).count).to eq(1)


    freeze_time(UserAuthToken::ROTATE_TIME.from_now)

    token.rotate!(user_agent: "firefox", client_ip: "1.1.1.1")

    expect(UserAuthTokenLog.where(
      action: "rotate",
      auth_token: token.auth_token,
      user_agent: "firefox",
      client_ip: "1.1.1.1",
      user_auth_token_id: token.id
    ).count).to eq(1)

  end

end
