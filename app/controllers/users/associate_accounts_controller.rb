# frozen_string_literal: true

class Users::AssociateAccountsController < ApplicationController
  SECURE_SESSION_PREFIX ||= "omniauth_reconnect"

  def connect_info
    auth = get_auth_hash

    provider_name = auth.provider
    authenticator = Discourse.enabled_authenticators.find { |a| a.name == provider_name }
    raise Discourse::InvalidAccess.new(I18n.t('authenticator_not_found')) if authenticator.nil?

    account_description = authenticator.description_for_auth_hash(auth)

    render json: { token: params[:token], provider_name: provider_name, account_description: account_description }
  end

  def connect
    auth = get_auth_hash
    secure_session[self.class.key(params[:token])] = nil

    provider_name = auth.provider
    authenticator = Discourse.enabled_authenticators.find { |a| a.name == provider_name }
    raise Discourse::InvalidAccess.new(I18n.t('authenticator_not_found')) if authenticator.nil?

    DiscourseEvent.trigger(:before_auth, authenticator, auth, session, cookies, request)
    auth_result = authenticator.after_authenticate(auth, existing_account: current_user)
    DiscourseEvent.trigger(:after_auth, authenticator, auth_result, session, cookies, request)

    render json: success_json
  end

  private

  def get_auth_hash
    token = params[:token]
    json = secure_session[self.class.key(token)]
    raise Discourse::NotFound if json.nil?

    OmniAuth::AuthHash.new(JSON.parse(json))
  end

  def self.key(token)
    "#{SECURE_SESSION_PREFIX}_#{token}"
  end
end
