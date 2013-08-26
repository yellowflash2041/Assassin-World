# -*- encoding : utf-8 -*-
require_dependency 'email'
require_dependency 'enum'
require_dependency 'user_name_suggester'
require_dependency 'auth/authenticator'
require_dependency 'auth/facebook_authenticator'
require_dependency 'auth/open_id_authenticator'
require_dependency 'auth/github_authenticator'
require_dependency 'auth/twitter_authenticator'
require_dependency 'auth/persona_authenticator'

class Users::OmniauthCallbacksController < ApplicationController

  BUILTIN_AUTH = [
    Auth::FacebookAuthenticator.new,
    Auth::OpenIdAuthenticator.new("google", trusted: true),
    Auth::OpenIdAuthenticator.new("yahoo", trusted: true),
    Auth::GithubAuthenticator.new,
    Auth::TwitterAuthenticator.new,
    Auth::PersonaAuthenticator.new
  ]

  skip_before_filter :redirect_to_login_if_required

  layout false

  def self.types
    @types ||= Enum.new(:facebook, :twitter, :google, :yahoo, :github, :persona, :cas)
  end

  # need to be able to call this
  skip_before_filter :check_xhr

  # this is the only spot where we allow CSRF, our openid / oauth redirect
  # will not have a CSRF token, however the payload is all validated so its safe
  skip_before_filter :verify_authenticity_token, only: :complete

  def complete
    auth = request.env["omniauth.auth"]

    authenticator = self.class.find_authenticator(params[:provider])

    @data = authenticator.after_authenticate(auth)
    @data.authenticator_name = authenticator.name

    user_found(@data.user) if @data.user

    session[:authentication] = @data.session_data

    respond_to do |format|
      format.html
      format.json { render json: @data }
    end
  end

  def failure
    flash[:error] = I18n.t("login.omniauth_error", strategy: params[:strategy].titleize)
    render layout: 'no_js'
  end


  def self.find_authenticator(name)
    BUILTIN_AUTH.each do |authenticator|
      if authenticator.name == name
        raise Discourse::InvalidAccess.new("provider is not enabled") unless SiteSetting.send("enable_#{name}_logins?")

        return authenticator
      end
    end

    Discourse.auth_providers.each do |provider|
      if provider.name == name

        return provider.authenticator
      end
    end

    raise Discourse::InvalidAccess.new("provider is not found")
  end

  protected

  def user_found(user)
    # automatically activate any account if a provider marked the email valid
    if !user.active && @data.email_valid
      user.toggle(:active).save
    end

    # log on any account that is active with forum access
    if Guardian.new(user).can_access_forum? && user.active
      log_on_user(user)
      @data.authenticated = true
    else
      if SiteSetting.invite_only?
        @data.awaiting_approval = true
      else
        @data.awaiting_activation = true
      end
    end
  end

end
