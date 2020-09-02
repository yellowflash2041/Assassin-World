# frozen_string_literal: true

class InvitesController < ApplicationController

  requires_login only: [
    :destroy, :create, :create_invite_link, :rescind_all_invites,
    :resend_invite, :resend_all_invites, :upload_csv
  ]

  skip_before_action :check_xhr, except: [:perform_accept_invitation]
  skip_before_action :preload_json, except: [:show]
  skip_before_action :redirect_to_login_if_required

  before_action :ensure_new_registrations_allowed, only: [:show, :perform_accept_invitation]
  before_action :ensure_not_logged_in, only: [:show, :perform_accept_invitation]

  def show
    expires_now

    invite = Invite.find_by(invite_key: params[:id])

    if invite.present? && !invite.expired?
      if !invite.redeemed?
        store_preloaded("invite_info", MultiJson.dump(
          invited_by: UserNameSerializer.new(invite.invited_by, scope: guardian, root: false),
          email: invite.email,
          username: UserNameSuggester.suggest(invite.email),
          is_invite_link: invite.is_invite_link?)
        )

        render layout: 'application'
      else
        flash.now[:error] = I18n.t('invite.not_found_template', site_name: SiteSetting.title, base_url: Discourse.base_url)
        render layout: 'no_ember'
      end
    else
      flash.now[:error] = I18n.t('invite.not_found', base_url: Discourse.base_url)
      render layout: 'no_ember'
    end
  end

  def perform_accept_invitation
    params.require(:id)
    params.permit(:email, :username, :name, :password, :timezone, user_custom_fields: {})
    invite = Invite.find_by(invite_key: params[:id])

    if invite.present?
      begin
        user = if invite.is_invite_link?
          invite.redeem_invite_link(email: params[:email], username: params[:username], name: params[:name], password: params[:password], user_custom_fields: params[:user_custom_fields], ip_address: request.remote_ip)
        else
          invite.redeem(username: params[:username], name: params[:name], password: params[:password], user_custom_fields: params[:user_custom_fields], ip_address: request.remote_ip)
        end

        if user.present?
          log_on_user(user) if user.active?
          user.update_timezone_if_missing(params[:timezone])
          post_process_invite(user)
          response = { success: true }
        else
          response = { success: false, message: I18n.t('invite.not_found_json') }
        end

        if user.present? && user.active?
          topic = invite.topics.first
          response[:redirect_to] = topic.present? ? path("#{topic.relative_url}") : path("/")
        elsif user.present?
          response[:message] = I18n.t('invite.confirm_email')
        end

        render json: response
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotSaved => e
        render json: {
          success: false,
          errors: e.record&.errors&.to_hash || {},
          message: I18n.t('invite.error_message')
        }
      rescue Invite::UserExists => e
        render json: { success: false, message: [e.message] }
      end
    else
      render json: { success: false, message: I18n.t('invite.not_found_json') }
    end
  end

  def create
    params.require(:email)

    groups = Group.lookup_groups(
      group_ids: params[:group_ids],
      group_names: params[:group_names]
    )

    guardian.ensure_can_invite_to_forum!(groups)
    group_ids = groups.map(&:id)

    invite_exists = Invite.exists?(email: params[:email], invited_by_id: current_user.id)
    if invite_exists && !guardian.can_send_multiple_invites?(current_user)
      return render json: failed_json, status: 422
    end

    begin
      if Invite.invite_by_email(params[:email], current_user, nil, group_ids, params[:custom_message])
        render json: success_json
      else
        render json: failed_json, status: 422
      end
    rescue Invite::UserExists, ActiveRecord::RecordInvalid => e
      render json: { errors: [e.message] }, status: 422
    end
  end

  def create_invite_link
    params.permit(:email, :max_redemptions_allowed, :expires_at, :group_ids, :group_names, :topic_id)

    is_single_invite = params[:email].present?
    unless is_single_invite
      guardian.ensure_can_send_invite_links!(current_user)
    end

    groups = Group.lookup_groups(
      group_ids: params[:group_ids],
      group_names: params[:group_names]
    )
    if !guardian.can_invite_to_forum?(groups)
      raise StandardError.new I18n.t("invite.cant_invite_to_group")
    end
    group_ids = groups.map(&:id)

    if is_single_invite
      invite_exists = Invite.exists?(email: params[:email], invited_by_id: current_user.id)
      if invite_exists && !guardian.can_send_multiple_invites?(current_user)
        return render json: failed_json, status: 422
      end

      if params[:topic_id].present?
        topic = Topic.find_by(id: params[:topic_id])

        if topic.present?
          guardian.ensure_can_invite_to!(topic)
        else
          raise Discourse::InvalidParameters.new(:topic_id)
        end
      end
    end

    invite_link = if is_single_invite
      Invite.generate_single_use_invite_link(params[:email], current_user, topic, group_ids)
    else
      Invite.generate_multiple_use_invite_link(
        invited_by: current_user,
        max_redemptions_allowed: params[:max_redemptions_allowed],
        expires_at: params[:expires_at],
        group_ids: group_ids
      )
    end
    if invite_link.present?
      render_json_dump(invite_link)
    else
      render json: failed_json, status: 422
    end
  rescue => e
    render json: { errors: [e.message] }, status: 422
  end

  def destroy
    params.require(:id)

    invite = Invite.find_by(invited_by_id: current_user.id, id: params[:id])
    raise Discourse::InvalidParameters.new(:id) if invite.blank?
    invite.trash!(current_user)

    render json: success_json
  end

  def rescind_all_invites
    guardian.ensure_can_rescind_all_invites!(current_user)

    Invite.rescind_all_expired_invites_from(current_user)
    render json: success_json
  end

  def resend_invite
    params.require(:email)
    RateLimiter.new(current_user, "resend-invite-per-hour", 10, 1.hour).performed!

    invite = Invite.find_by(invited_by_id: current_user.id, email: params[:email])
    raise Discourse::InvalidParameters.new(:email) if invite.blank?
    invite.resend_invite
    render json: success_json

  rescue RateLimiter::LimitExceeded
    render_json_error(I18n.t("rate_limiter.slow_down"))
  end

  def resend_all_invites
    guardian.ensure_can_resend_all_invites!(current_user)

    Invite.resend_all_invites_from(current_user.id)
    render json: success_json
  end

  def upload_csv
    require 'csv'

    guardian.ensure_can_bulk_invite_to_forum!(current_user)

    hijack do
      begin
        file = params[:file] || params[:files].first

        count = 0
        invites = []
        max_bulk_invites = SiteSetting.max_bulk_invites
        CSV.foreach(file.tempfile) do |row|
          count += 1
          invites.push(email: row[0], groups: row[1], topic_id: row[2]) if row[0].present?
          break if count >= max_bulk_invites
        end

        if invites.present?
          Jobs.enqueue(:bulk_invite, invites: invites, current_user_id: current_user.id)
          if count >= max_bulk_invites
            render json: failed_json.merge(errors: [I18n.t("bulk_invite.max_rows", max_bulk_invites: max_bulk_invites)]), status: 422
          else
            render json: success_json
          end
        else
          render json: failed_json.merge(errors: [I18n.t("bulk_invite.error")]), status: 422
        end
      rescue
        render json: failed_json.merge(errors: [I18n.t("bulk_invite.error")]), status: 422
      end
    end
  end

  def fetch_username
    params.require(:username)
    params[:username]
  end

  def fetch_email
    params.require(:email)
    params[:email]
  end

  def ensure_new_registrations_allowed
    unless SiteSetting.allow_new_registrations
      flash[:error] = I18n.t('login.new_registrations_disabled')
      render layout: 'no_ember'
      false
    end
  end

  def ensure_not_logged_in
    if current_user
      flash[:error] = I18n.t("login.already_logged_in", current_user: current_user.username)
      render layout: 'no_ember'
      false
    end
  end

  private

  def post_process_invite(user)
    user.enqueue_welcome_message('welcome_invite') if user.send_welcome_message

    Group.refresh_automatic_groups!(:admins, :moderators, :staff) if user.staff?

    if user.has_password?
      send_activation_email(user) unless user.active
    elsif !SiteSetting.enable_sso && SiteSetting.enable_local_logins
      Jobs.enqueue(:invite_password_instructions_email, username: user.username)
    end
  end

  def send_activation_email(user)
    email_token = user.email_tokens.create!(email: user.email)

    Jobs.enqueue(:critical_user_email,
                 type: :signup,
                 user_id: user.id,
                 email_token: email_token.token
    )
  end
end
