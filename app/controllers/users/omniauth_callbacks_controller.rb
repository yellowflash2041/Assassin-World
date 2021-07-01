# -*- encoding : utf-8 -*-
# frozen_string_literal: true

class Users::OmniauthCallbacksController < ApplicationController

  skip_before_action :redirect_to_login_if_required

  layout 'no_ember'

  # need to be able to call this
  skip_before_action :check_xhr

  # this is the only spot where we allow CSRF, our openid / oauth redirect
  # will not have a CSRF token, however the payload is all validated so its safe
  skip_before_action :verify_authenticity_token, only: :complete

  def confirm_request
    self.class.find_authenticator(params[:provider])
    render locals: { hide_auth_buttons: true }
  end

  def complete
    auth = request.env["omniauth.auth"]
    raise Discourse::NotFound unless request.env["omniauth.auth"]

    auth[:session] = session

    authenticator = self.class.find_authenticator(params[:provider])

    if session.delete(:auth_reconnect) && authenticator.can_connect_existing_user? && current_user
      # Save to redis, with a secret token, then redirect to confirmation screen
      token = SecureRandom.hex
      Discourse.redis.setex "#{Users::AssociateAccountsController::REDIS_PREFIX}_#{current_user.id}_#{token}", 10.minutes, auth.to_json
      return redirect_to "#{Discourse.base_path}/associate/#{token}"
    else
      DiscourseEvent.trigger(:before_auth, authenticator, auth, session, cookies)
      @auth_result = authenticator.after_authenticate(auth)
      @auth_result.user = nil if @auth_result&.user&.staged # Treat staged users the same as unregistered users
      DiscourseEvent.trigger(:after_auth, authenticator, @auth_result, session, cookies)
    end

    preferred_origin = request.env['omniauth.origin']

    if session[:destination_url].present?
      preferred_origin = session[:destination_url]
      session.delete(:destination_url)
    elsif SiteSetting.enable_discourse_connect_provider && payload = cookies.delete(:sso_payload)
      preferred_origin = session_sso_provider_url + "?" + payload
    elsif cookies[:destination_url].present?
      preferred_origin = cookies[:destination_url]
      cookies.delete(:destination_url)
    end

    if preferred_origin.present?
      parsed = begin
        URI.parse(preferred_origin)
      rescue URI::Error
      end

      if valid_origin?(parsed)
        @origin = +"#{parsed.path}"
        @origin << "?#{parsed.query}" if parsed.query
      end
    end

    if @origin.blank?
      @origin = Discourse.base_path("/")
    end

    @auth_result.destination_url = @origin
    @auth_result.authenticator_name = authenticator.name

    return render_auth_result_failure if @auth_result.failed?

    complete_response_data

    return render_auth_result_failure if @auth_result.failed?

    cookies['_bypass_cache'] = true
    cookies[:authentication_data] = {
      value: @auth_result.to_client_hash.to_json,
      path: Discourse.base_path("/")
    }
    redirect_to @origin
  end

  def valid_origin?(uri)
    return false if uri.nil?
    return false if uri.host.present? && uri.host != Discourse.current_hostname
    return false if uri.path.start_with?("#{Discourse.base_path}/auth/")
    return false if uri.path.start_with?("#{Discourse.base_path}/login")
    true
  end

  def failure
    error_key = params[:message].to_s.gsub(/[^\w-]/, "") || "generic"
    flash[:error] = I18n.t("login.omniauth_error.#{error_key}", default: I18n.t("login.omniauth_error.generic"))
    render 'failure'
  end

  def self.find_authenticator(name)
    Discourse.enabled_authenticators.each do |authenticator|
      return authenticator if authenticator.name == name
    end
    raise Discourse::InvalidAccess.new(I18n.t('authenticator_not_found'))
  end

  protected

  def render_auth_result_failure
    flash[:error] = @auth_result.failed_reason.html_safe
    render 'failure'
  end

  def complete_response_data
    if @auth_result.user
      user_found(@auth_result.user)
    elsif invite_required?
      @auth_result.requires_invite = true
    else
      session[:authentication] = @auth_result.session_data
    end
  end

  def invite_required?
    if SiteSetting.invite_only?
      path = Discourse.route_for(@origin)
      return true unless path
      return true if path[:controller] != "invites" && path[:action] != "show"
      !Invite.exists?(invite_key: path[:id])
    end
  end

  def user_found(user)
    if user.has_any_second_factor_methods_enabled?
      @auth_result.omniauth_disallow_totp = true
      @auth_result.email = user.email
      return
    end

    # automatically activate any account if a provider marked the email valid
    if @auth_result.email_valid && @auth_result.email == user.email
      if !user.active || !user.email_confirmed?
        user.update!(password: SecureRandom.hex)

        # Ensure there is an active email token
        unless EmailToken.where(email: user.email, confirmed: true).exists? ||
          user.email_tokens.active.where(email: user.email).exists?
          user.email_tokens.create!(email: user.email)
        end

        user.activate
      end
      user.update!(registration_ip_address: request.remote_ip) if user.registration_ip_address.blank?
    end

    if ScreenedIpAddress.should_block?(request.remote_ip)
      @auth_result.not_allowed_from_ip_address = true
    elsif ScreenedIpAddress.block_admin_login?(user, request.remote_ip)
      @auth_result.admin_not_allowed_from_ip_address = true
    elsif Guardian.new(user).can_access_forum? && user.active # log on any account that is active with forum access
      begin
        user.save! if @auth_result.apply_user_attributes!
      rescue ActiveRecord::RecordInvalid => e
        @auth_result.failed = true
        @auth_result.failed_reason = e.record.errors.full_messages.join(", ")
        return
      end

      log_on_user(user)
      Invite.invalidate_for_email(user.email) # invite link can't be used to log in anymore
      session[:authentication] = nil # don't carry around old auth info, perhaps move elsewhere
      @auth_result.authenticated = true
    else
      if SiteSetting.must_approve_users? && !user.approved?
        @auth_result.awaiting_approval = true
      else
        @auth_result.awaiting_activation = true
      end
    end
  end

end
