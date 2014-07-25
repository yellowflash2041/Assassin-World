class StaticController < ApplicationController

  skip_before_filter :check_xhr, :redirect_to_login_if_required
  skip_before_filter :verify_authenticity_token, only: [:enter]

  def show

    return redirect_to('/') if current_user && params[:id] == 'login'

    map = {
      "faq" => "faq_url",
      "tos" => "tos_url",
      "privacy" =>  "privacy_policy_url"
    }

    page = params[:id]

    if site_setting_key = map[page]
      url = SiteSetting.send(site_setting_key)
      return redirect_to(url) unless url.blank?
    end

    # The /guidelines route ALWAYS shows our FAQ, ignoring the faq_url site setting.
    page = 'faq' if page == 'guidelines'

    # Don't allow paths like ".." or "/" or anything hacky like that
    page.gsub!(/[^a-z0-9\_\-]/, '')

    file = "static/#{page}.#{I18n.locale}"

    # if we don't have a localized version, try the English one
    if not lookup_context.find_all("#{file}.html").any?
      file = "static/#{page}.en"
    end

    if not lookup_context.find_all("#{file}.html").any?
      file = "static/#{page}"
    end

    if lookup_context.find_all("#{file}.html").any?
      @faq_overriden = !SiteSetting.faq_url.blank?
      render file, layout: !request.xhr?, formats: [:html]
      return
    end

    raise Discourse::NotFound
  end

  # This method just redirects to a given url.
  # It's used when an ajax login was successful but we want the browser to see
  # a post of a login form so that it offers to remember your password.
  def enter
    params.delete(:username)
    params.delete(:password)

    redirect_to(
      if params[:redirect].blank? || params[:redirect].match(login_path)
        "/"
      else
        params[:redirect]
      end
    )
  end

  skip_before_filter :store_incoming_links, :verify_authenticity_token, only: [:cdn_asset]
  def cdn_asset
    path = File.expand_path(Rails.root + "public/assets/" + params[:path])

    # SECURITY what if path has /../
    unless path.start_with?(Rails.root.to_s + "/public/assets")
      raise Discourse::NotFound
    end

    expires_in 1.year, public: true
    response.headers["Access-Control-Allow-Origin"] = params[:origin]
    begin
      response.headers["Last-Modified"] = File.ctime(path).httpdate
    rescue Errno::ENOENT
      raise Discourse::NotFound
    end
    opts = {
      disposition: nil
    }
    opts[:type] = "application/x-javascript" if path =~ /\.js$/

    # we must disable acceleration otherwise NGINX strips
    # access control headers
    request.env['sendfile.type'] = ''
    send_file(path, opts)
  end
end
