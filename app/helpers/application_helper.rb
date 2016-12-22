require 'current_user'
require 'canonical_url'
require_dependency 'guardian'
require_dependency 'unread'
require_dependency 'age_words'
require_dependency 'configurable_urls'
require_dependency 'mobile_detection'
require_dependency 'category_badge'
require_dependency 'global_path'
require_dependency 'canonical_url'

module ApplicationHelper
  include CurrentUser
  include CanonicalURL::Helpers
  include ConfigurableUrls
  include GlobalPath

  def google_universal_analytics_json(ua_domain_name=nil)
    result = {}
    if ua_domain_name
      result[:cookieDomain] = ua_domain_name.gsub(/^http(s)?:\/\//, '')
    end
    if current_user.present?
      result[:userId] = current_user.id
    end
    result.to_json.html_safe
  end

  def ga_universal_json
    google_universal_analytics_json(SiteSetting.ga_universal_domain_name)
  end

  def google_tag_manager_json
    google_universal_analytics_json
  end

  def shared_session_key
    if SiteSetting.long_polling_base_url != '/'.freeze && current_user
      sk = "shared_session_key"
      return request.env[sk] if request.env[sk]

      request.env[sk] = key = (session[sk] ||= SecureRandom.hex)
      $redis.setex "#{sk}_#{key}", 7.days, current_user.id.to_s
      key
    end
  end

  def script(*args)
    if  GlobalSetting.cdn_url &&
        GlobalSetting.cdn_url.start_with?("https") &&
        ENV["COMPRESS_BROTLI"] == "1" &&
        request.env["HTTP_ACCEPT_ENCODING"] =~ /br/
      tags = javascript_include_tag(*args)
      tags.gsub!("#{GlobalSetting.cdn_url}/assets/", "#{GlobalSetting.cdn_url}/brotli_asset/")
      tags.html_safe
    else
      javascript_include_tag(*args)
    end
  end

  def discourse_csrf_tags
    # anon can not have a CSRF token cause these are all pages
    # that may be cached, causing a mismatch between session CSRF
    # and CSRF on page and horrible impossible to debug login issues
    if current_user
      csrf_meta_tags
    end
  end

  def html_classes
    "#{mobile_view? ? 'mobile-view' : 'desktop-view'} #{mobile_device? ? 'mobile-device' : 'not-mobile-device'} #{rtl_class} #{current_user ? '' : 'anon'}"
  end

  def body_classes
    if @category && @category.url.present?
      "category-#{@category.url.sub(/^\/c\//, '').gsub(/\//, '-')}"
    end
  end

  def rtl_class
    rtl? ? 'rtl' : ''
  end

  def escape_unicode(javascript)
    if javascript
      javascript = javascript.scrub
      javascript.gsub!(/\342\200\250/u, '&#x2028;')
      javascript.gsub!(/(<\/)/u, '\u003C/')
      javascript.html_safe
    else
      ''
    end
  end

  def format_topic_title(title)
    PrettyText.unescape_emoji strip_tags(title)
  end

  def with_format(format, &block)
    old_formats = formats
    self.formats = [format]
    block.call
    self.formats = old_formats
    nil
  end

  def age_words(secs)
    AgeWords.age_words(secs)
  end

  def short_date(dt)
    if dt.year == Time.now.year
      I18n.l(dt, format: :short_no_year)
    else
      I18n.l(dt, format: :date_only)
    end
  end

  def guardian
    @guardian ||= Guardian.new(current_user)
  end

  def mini_profiler_enabled?
    defined?(Rack::MiniProfiler) && admin?
  end

  def admin?
    current_user.try(:admin?)
  end

  def moderator?
    current_user.try(:moderator?)
  end

  def staff?
    current_user.try(:staff?)
  end

  def rtl?
    ["ar", "ur", "fa_IR", "he"].include? I18n.locale.to_s
  end

  def user_locale
    locale = current_user.locale if current_user && SiteSetting.allow_user_locale
    # changing back to default shoves a blank string there
    locale.present? ? locale : SiteSetting.default_locale
  end

  # Creates open graph and twitter card meta data
  def crawlable_meta_data(opts=nil)
    opts ||= {}
    opts[:url] ||= "#{Discourse.base_url_no_prefix}#{request.fullpath}"

    if opts[:image].blank? && (SiteSetting.default_opengraph_image_url.present? || SiteSetting.twitter_summary_large_image_url.present?)
      opts[:twitter_summary_large_image] = SiteSetting.twitter_summary_large_image_url if SiteSetting.twitter_summary_large_image_url.present?
      opts[:image] = SiteSetting.default_opengraph_image_url.present? ? SiteSetting.default_opengraph_image_url : SiteSetting.twitter_summary_large_image_url
    elsif opts[:image].blank? && SiteSetting.apple_touch_icon_url.present?
      opts[:image] = SiteSetting.apple_touch_icon_url
    end

    # Use the correct scheme for open graph image
    if opts[:image].present?
      if opts[:image].start_with?("//")
        uri = URI(Discourse.base_url)
        opts[:image] = "#{uri.scheme}:#{opts[:image]}"
      elsif opts[:image].start_with?("/uploads/")
        opts[:image] = "#{Discourse.base_url}#{opts[:image]}"
      elsif GlobalSetting.relative_url_root && opts[:image].start_with?(GlobalSetting.relative_url_root)
        opts[:image] = "#{Discourse.base_url_no_prefix}#{opts[:image]}"
      end
    end

    # Add opengraph & twitter tags
    result = []
    result << tag(:meta, property: 'og:site_name', content: SiteSetting.title)

    if opts[:twitter_summary_large_image].present?
      result << tag(:meta, name: 'twitter:card', content: "summary_large_image")
      result << tag(:meta, name: "twitter:image", content: opts[:twitter_summary_large_image])
    elsif opts[:image].present?
      result << tag(:meta, name: 'twitter:card', content: "summary")
      result << tag(:meta, name: "twitter:image", content: opts[:image])
    else
      result << tag(:meta, name: 'twitter:card', content: "summary")
    end
    result << tag(:meta, property: "og:image", content: opts[:image]) if opts[:image].present?

    [:url, :title, :description].each do |property|
      if opts[property].present?
        escape = (property != :image)
        result << tag(:meta, { property: "og:#{property}", content: opts[property] }, nil, escape)
        result << tag(:meta, { name: "twitter:#{property}", content: opts[property] }, nil, escape)
      end
    end

    if opts[:read_time] && opts[:read_time] > 0 && opts[:like_count] && opts[:like_count] > 0
      result << tag(:meta, name: 'twitter:label1', value: I18n.t("reading_time"))
      result << tag(:meta, name: 'twitter:data1', value: "#{opts[:read_time]} mins 🕑")
      result << tag(:meta, name: 'twitter:label2', value: I18n.t("likes"))
      result << tag(:meta, name: 'twitter:data2', value: "#{opts[:like_count]} ❤")
    end

    result.join("\n")
  end

  def render_sitelinks_search_tag
    json = {
      '@context' => 'http://schema.org',
      '@type' => 'WebSite',
      url: Discourse.base_url,
      potentialAction: {
        '@type' => 'SearchAction',
        target: "#{Discourse.base_url}/search?q={search_term_string}",
        'query-input' => 'required name=search_term_string',
      }
    }
    content_tag(:script, MultiJson.dump(json).html_safe, type: 'application/ld+json'.freeze)
  end

  def application_logo_url
    @application_logo_url ||= (mobile_view? && SiteSetting.mobile_logo_url) || SiteSetting.logo_url
  end

  def login_path
    "#{Discourse::base_uri}/login"
  end

  def mobile_view?
    MobileDetection.resolve_mobile_view!(request.user_agent,params,session)
  end

  def crawler_layout?
    controller.try(:use_crawler_layout?)
  end

  def include_crawler_content?
    crawler_layout? || !mobile_view?
  end

  def mobile_device?
    MobileDetection.mobile_device?(request.user_agent)
  end

  NO_CUSTOM = "no_custom".freeze
  NO_PLUGINS = "no_plugins".freeze
  ONLY_OFFICIAL = "only_official".freeze
  SAFE_MODE = "safe_mode".freeze

  def customization_disabled?
    safe_mode = params[SAFE_MODE]
    session[:disable_customization] || (safe_mode && safe_mode.include?(NO_CUSTOM))
  end

  def allow_plugins?
    safe_mode = params[SAFE_MODE]
    !(safe_mode && safe_mode.include?(NO_PLUGINS))
  end

  def allow_third_party_plugins?
    safe_mode = params[SAFE_MODE]
    !(safe_mode && (safe_mode.include?(NO_PLUGINS) || safe_mode.include?(ONLY_OFFICIAL)))
  end

  def normalized_safe_mode
    mode_string = params["safe_mode"]
    safe_mode = nil
    (safe_mode ||= []) << NO_CUSTOM if mode_string.include?(NO_CUSTOM)
    (safe_mode ||= []) << NO_PLUGINS if mode_string.include?(NO_PLUGINS)
    (safe_mode ||= []) << ONLY_OFFICIAL if mode_string.include?(ONLY_OFFICIAL)
    if safe_mode
      safe_mode.join(",").html_safe
    end
  end

  def loading_admin?
    controller.class.name.split("::").first == "Admin"
  end

  def category_badge(category, opts=nil)
    CategoryBadge.html_for(category, opts).html_safe
  end

  def self.all_connectors
    @all_connectors = Dir.glob("plugins/*/app/views/connectors/**/*.html.erb")
  end

  def server_plugin_outlet(name)

    # Don't evaluate plugins in test
    return "" if Rails.env.test?

    matcher = Regexp.new("/connectors/#{name}/.*\.html\.erb$")
    erbs = ApplicationHelper.all_connectors.select {|c| c =~ matcher }
    return "" if erbs.blank?

    result = ""
    erbs.each {|erb| result << render(file: erb) }
    result.html_safe
  end

  def topic_featured_link_domain(link)
    begin
      uri = URI.encode(link)
      uri = URI.parse(uri)
      uri = URI.parse("http://#{uri}") if uri.scheme.nil?
      host = uri.host.downcase
      host.start_with?('www.') ? host[4..-1] : host
    rescue
      ''
    end
  end
end
