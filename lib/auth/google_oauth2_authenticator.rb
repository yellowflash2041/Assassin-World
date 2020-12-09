# frozen_string_literal: true

class Auth::GoogleOAuth2Authenticator < Auth::ManagedAuthenticator
  def name
    "google_oauth2"
  end

  def enabled?
    SiteSetting.enable_google_oauth2_logins
  end

  def primary_email_verified?(auth_token)
    # note, emails that come back from google via omniauth are always valid
    # this protects against future regressions
    auth_token[:extra][:raw_info][:email_verified]
  end

  def register_middleware(omniauth)
    options = {
      setup: lambda { |env|
        strategy = env["omniauth.strategy"]
        strategy.options[:client_id] = SiteSetting.google_oauth2_client_id
        strategy.options[:client_secret] = SiteSetting.google_oauth2_client_secret

        if (google_oauth2_hd = SiteSetting.google_oauth2_hd).present?
          strategy.options[:hd] = google_oauth2_hd
        end

        if (google_oauth2_prompt = SiteSetting.google_oauth2_prompt).present?
          strategy.options[:prompt] = google_oauth2_prompt.gsub("|", " ")
        end

        # All the data we need for the `info` and `credentials` auth hash
        # are obtained via the user info API, not the JWT. Using and verifying
        # the JWT can fail due to clock skew, so let's skip it completely.
        # https://github.com/zquestz/omniauth-google-oauth2/pull/392
        strategy.options[:skip_jwt] = true
      }
    }
    omniauth.provider :google_oauth2, options
  end
end
