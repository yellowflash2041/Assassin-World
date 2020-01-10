# frozen_string_literal: true

module SecondFactorManager
  TOTP_ALLOWED_DRIFT_SECONDS = 30

  extend ActiveSupport::Concern

  def create_totp(opts = {})
    require_rotp
    UserSecondFactor.create!({
                               user_id: self.id,
                               method: UserSecondFactor.methods[:totp],
                               data: ROTP::Base32.random
                             }.merge(opts))
  end

  def get_totp_object(data)
    require_rotp
    ROTP::TOTP.new(data, issuer: SiteSetting.title)
  end

  def totp_provisioning_uri(data)
    get_totp_object(data).provisioning_uri(self.email)
  end

  def authenticate_totp(token)
    totps = self&.user_second_factors.totps
    authenticated = false
    totps.each do |totp|

      last_used = 0

      if totp.last_used
        last_used = totp.last_used.to_i
      end

      authenticated = !token.blank? && totp.totp_object.verify(
        token,
        drift_ahead: TOTP_ALLOWED_DRIFT_SECONDS,
        drift_behind: TOTP_ALLOWED_DRIFT_SECONDS,
        after: last_used
      )

      if authenticated
        totp.update!(last_used: DateTime.now)
        break
      end
    end
    !!authenticated
  end

  def totp_enabled?
    !SiteSetting.enable_sso &&
      SiteSetting.enable_local_logins &&
      self&.user_second_factors.totps.exists?
  end

  def backup_codes_enabled?
    !SiteSetting.enable_sso &&
      SiteSetting.enable_local_logins &&
      self&.user_second_factors.backup_codes.exists?
  end

  def security_keys_enabled?
    !SiteSetting.enable_sso &&
      SiteSetting.enable_local_logins &&
      self&.security_keys.where(factor_type: UserSecurityKey.factor_types[:second_factor], enabled: true).exists?
  end

  def has_multiple_second_factor_methods?
    security_keys_enabled? && (totp_enabled? || backup_codes_enabled?)
  end

  def remaining_backup_codes
    self&.user_second_factors&.backup_codes&.count
  end

  def authenticate_second_factor(token, second_factor_method)
    if second_factor_method == UserSecondFactor.methods[:totp]
      authenticate_totp(token)
    elsif second_factor_method == UserSecondFactor.methods[:backup_codes]
      authenticate_backup_code(token)
    elsif second_factor_method == UserSecondFactor.methods[:security_key]
      # some craziness has happened if we have gotten here...like the user
      # switching around their second factor types then continuing an already
      # started login attempt
      false
    end
  end

  def generate_backup_codes
    codes = []
    10.times do
      codes << SecureRandom.hex(8)
    end

    codes_json = codes.map do |code|
      salt = SecureRandom.hex(16)
      { salt: salt,
        code_hash: hash_backup_code(code, salt)
      }
    end

    if self.user_second_factors.backup_codes.empty?
      create_backup_codes(codes_json)
    else
      self.user_second_factors.where(method: UserSecondFactor.methods[:backup_codes]).destroy_all
      create_backup_codes(codes_json)
    end

    codes
  end

  def create_backup_codes(codes)
    codes.each do |code|
      UserSecondFactor.create!(
        user_id: self.id,
        data: code.to_json,
        enabled: true,
        method: UserSecondFactor.methods[:backup_codes]
      )
    end
  end

  def authenticate_backup_code(backup_code)
    if !backup_code.blank?
      codes = self&.user_second_factors&.backup_codes

      codes.each do |code|
        stored_code = JSON.parse(code.data)["code_hash"]
        stored_salt = JSON.parse(code.data)["salt"]
        backup_hash = hash_backup_code(backup_code, stored_salt)
        next unless backup_hash == stored_code

        code.update(enabled: false, last_used: DateTime.now)
        return true
      end
      false
    end
    false
  end

  def hash_backup_code(code, salt)
    Pbkdf2.hash_password(code, salt, Rails.configuration.pbkdf2_iterations, Rails.configuration.pbkdf2_algorithm)
  end

  def require_rotp
    require 'rotp' if !defined? ROTP
  end
end
