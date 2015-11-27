class Admin::SiteTextsController < Admin::AdminController

  def self.preferred_keys
    ['system_messages.usage_tips.text_body_template',
     'education.new-topic',
     'education.new-reply',
     'login_required.welcome_message']
  end

  def index
    if params[:q].blank?
      results = self.class.preferred_keys.map {|k| {id: k, value: I18n.t(k) }}
    else
      results = []
      translations = I18n.search(params[:q])
      translations.each do |k, v|
        results << {id: k, value: v}
      end
      results.sort! do |x, y|
        (x[:id].size + x[:value].size) <=> (y[:id].size + y[:value].size)
      end
    end

    render_serialized(results[0..50], SiteTextSerializer, root: 'site_texts', rest_serializer: true)
  end

  def show
    site_text = find_site_text
    render_serialized(site_text, SiteTextSerializer, root: 'site_text', rest_serializer: true)
  end

  def update
    site_text = find_site_text
    site_text[:value] = params[:site_text][:value]

    TranslationOverride.upsert!(I18n.locale, site_text[:id], site_text[:value])
    render_serialized(site_text, SiteTextSerializer, root: 'site_text', rest_serializer: true)
  end

  def revert
    site_text = find_site_text
    TranslationOverride.revert!(I18n.locale, site_text[:id])
    site_text = find_site_text
    render_serialized(site_text, SiteTextSerializer, root: 'site_text', rest_serializer: true)
  end

  protected

    def find_site_text
      raise Discourse::NotFound unless I18n.exists?(params[:id])
      {id: params[:id], value: I18n.t(params[:id]) }
    end

end
