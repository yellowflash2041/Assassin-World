require_dependency 'nokogiri'

class TopicEmbed < ActiveRecord::Base
  belongs_to :topic
  belongs_to :post
  validates_presence_of :embed_url
  validates_presence_of :content_sha1

  def self.normalize_url(url)
    url.downcase.sub(/\/$/, '').sub(/\-+/, '-')
  end

  # Import an article from a source (RSS/Atom/Other)
  def self.import(user, url, title, contents)
    return unless url =~ /^https?\:\/\//

    if SiteSetting.embed_truncate
      contents = first_paragraph_from(contents)
    end
    contents << "\n<hr>\n<small>#{I18n.t('embed.imported_from', link: "<a href='#{url}'>#{url}</a>")}</small>\n"

    url = normalize_url(url)

    embed = TopicEmbed.where("lower(embed_url) = ?", url).first
    content_sha1 = Digest::SHA1.hexdigest(contents)
    post = nil

    # If there is no embed, create a topic, post and the embed.
    if embed.blank?
      Topic.transaction do
        creator = PostCreator.new(user,
                                  title: title,
                                  raw: absolutize_urls(url, contents),
                                  skip_validations: true,
                                  cook_method: Post.cook_methods[:raw_html],
                                  category: SiteSetting.embed_category)
        post = creator.create
        if post.present?
          TopicEmbed.create!(topic_id: post.topic_id,
                             embed_url: url,
                             content_sha1: content_sha1,
                             post_id: post.id)
        end
      end
    else
      absolutize_urls(url, contents)
      post = embed.post
      # Update the topic if it changed
      if content_sha1 != embed.content_sha1
        revisor = PostRevisor.new(post)
        revisor.revise!(user, absolutize_urls(url, contents), skip_validations: true, bypass_rate_limiter: true)
        embed.update_column(:content_sha1, content_sha1)
      end
    end

    post
  end

  def self.import_remote(user, url, opts=nil)
    require 'ruby-readability'

    url = normalize_url(url)
    opts = opts || {}
    doc = Readability::Document.new(open(url).read,
                                        tags: %w[div p code pre h1 h2 h3 b em i strong a img ul li ol],
                                        attributes: %w[href src])

    TopicEmbed.import(user, url, opts[:title] || doc.title, doc.content)
  end

  # Convert any relative URLs to absolute. RSS is annoying for this.
  def self.absolutize_urls(url, contents)
    url = normalize_url(url)
    uri = URI(url)
    prefix = "#{uri.scheme}://#{uri.host}"
    prefix << ":#{uri.port}" if uri.port != 80 && uri.port != 443

    fragment = Nokogiri::HTML.fragment("<div>#{contents}</div>")
    fragment.css('a').each do |a|
      href = a['href']
      if href.present? && href.start_with?('/')
        a['href'] = "#{prefix}/#{href.sub(/^\/+/, '')}"
      end
    end
    fragment.css('img').each do |a|
      src = a['src']
      if src.present? && src.start_with?('/')
        a['src'] = "#{prefix}/#{src.sub(/^\/+/, '')}"
      end
    end
    fragment.at('div').inner_html
  end

  def self.topic_id_for_embed(embed_url)
    embed_url = normalize_url(embed_url)
    TopicEmbed.where("lower(embed_url) = ?", embed_url).pluck(:topic_id).first
  end

  def self.first_paragraph_from(html)
    doc = Nokogiri::HTML(html)

    result = ""
    doc.css('p').each do |p|
      if p.text.present?
        result << p.to_s
        return result if result.size >= 100
      end
    end
    return result unless result.blank?

    # If there is no first paragaph, return the first div (onebox)
    doc.css('div').first
  end
end

# == Schema Information
#
# Table name: topic_embeds
#
#  id           :integer          not null, primary key
#  topic_id     :integer          not null
#  post_id      :integer          not null
#  embed_url    :string(255)      not null
#  content_sha1 :string(40)       not null
#  created_at   :datetime
#  updated_at   :datetime
#
# Indexes
#
#  index_topic_embeds_on_embed_url  (embed_url) UNIQUE
#
