require_dependency 'url_helper'
require_dependency 'file_helper'
require_dependency 'upload_creator'

module Jobs

  class PullHotlinkedImages < Jobs::Base
    sidekiq_options queue: 'low'

    def initialize
      @max_size = SiteSetting.max_image_size_kb.kilobytes
    end

    def download(src)
      downloaded = nil

      begin
        retries ||= 3

        downloaded = FileHelper.download(
          src,
          max_file_size: @max_size,
          retain_on_max_file_size_exceeded: true,
          tmp_file_name: "discourse-hotlinked",
          follow_redirect: true
        )
      rescue
        if (retries -= 1) > 0 && !Rails.env.test?
          sleep 1
          retry
        end
      end

      downloaded
    end

    def execute(args)
      post_id = args[:post_id]
      raise Discourse::InvalidParameters.new(:post_id) unless post_id.present?

      post = Post.find_by(id: post_id)
      return unless post.present?

      raw = post.raw.dup
      start_raw = raw.dup

      downloaded_urls = {}

      large_images = JSON.parse(post.custom_fields[Post::LARGE_IMAGES].presence || "[]")
      broken_images = JSON.parse(post.custom_fields[Post::BROKEN_IMAGES].presence || "[]")
      downloaded_images = JSON.parse(post.custom_fields[Post::DOWNLOADED_IMAGES].presence || "{}")

      has_new_large_image  = false
      has_new_broken_image = false
      has_downloaded_image = false

      extract_images_from(post.cooked).each do |image|
        src = original_src = image['src']
        src = "#{SiteSetting.force_https ? "https" : "http"}:#{src}" if src.start_with?("//")

        if should_download_image?(src)
          begin
            # have we already downloaded that file?
            schemeless_src = remove_scheme(original_src)

            unless downloaded_images.include?(schemeless_src) || large_images.include?(schemeless_src) || broken_images.include?(schemeless_src)
              if hotlinked = download(src)
                if File.size(hotlinked.path) <= @max_size
                  filename = File.basename(URI.parse(src).path)
                  filename << File.extname(hotlinked.path) unless filename["."]
                  upload = UploadCreator.new(hotlinked, filename, origin: src).create_for(post.user_id)
                  if upload.persisted?
                    downloaded_urls[src] = upload.url
                    downloaded_images[remove_scheme(src)] = upload.id
                    has_downloaded_image = true
                  else
                    log(:info, "Failed to pull hotlinked image for post: #{post_id}: #{src} - #{upload.errors.full_messages.join("\n")}")
                  end
                else
                  large_images << remove_scheme(original_src)
                  has_new_large_image = true
                end
              else
                broken_images << remove_scheme(original_src)
                has_new_broken_image = true
              end
            end
            # have we successfully downloaded that file?
            if downloaded_urls[src].present?
              url = downloaded_urls[src]
              escaped_src = Regexp.escape(original_src)
              # there are 6 ways to insert an image in a post
              # HTML tag - <img src="http://...">
              raw.gsub!(/src=["']#{escaped_src}["']/i, "src='#{url}'")
              # BBCode tag - [img]http://...[/img]
              raw.gsub!(/\[img\]#{escaped_src}\[\/img\]/i, "[img]#{url}[/img]")
              # Markdown linked image - [![alt](http://...)](http://...)
              raw.gsub!(/\[!\[([^\]]*)\]\(#{escaped_src}\)\]/) { "[<img src='#{url}' alt='#{$1}'>]" }
              # Markdown inline - ![alt](http://...)
              raw.gsub!(/!\[([^\]]*)\]\(#{escaped_src}\)/) { "![#{$1}](#{url})" }
              # Markdown inline - ![](http://... "image title")
              raw.gsub!(/!\[\]\(#{escaped_src} "([^\]]*)"\)/) { "![](#{url})" }
              # Markdown inline - ![alt](http://... "image title")
              raw.gsub!(/!\[([^\]]*)\]\(#{escaped_src} "([^\]]*)"\)/) { "![](#{url})" }
              # Markdown reference - [x]: http://
              raw.gsub!(/\[([^\]]+)\]:\s?#{escaped_src}/) { "[#{$1}]: #{url}" }
              # Direct link
              raw.gsub!(/^#{escaped_src}(\s?)$/) { "<img src='#{url}'>#{$1}" }
            end
          rescue => e
            log(:error, "Failed to pull hotlinked image (#{src}) post: #{post_id}\n" + e.message + "\n" + e.backtrace.join("\n"))
          end
        end
      end

      large_images.uniq!
      broken_images.uniq!

      post.custom_fields[Post::LARGE_IMAGES]      = large_images.to_json      if large_images.present?
      post.custom_fields[Post::BROKEN_IMAGES]     = broken_images.to_json     if broken_images.present?
      post.custom_fields[Post::DOWNLOADED_IMAGES] = downloaded_images.to_json if downloaded_images.present?
      # only save custom fields if there are any
      post.save_custom_fields if large_images.present? || broken_images.present? || downloaded_images.present?

      post.reload

      if start_raw == post.raw && raw != post.raw
        changes = { raw: raw, edit_reason: I18n.t("upload.edit_reason") }
        post.revise(Discourse.system_user, changes, bypass_bump: true)
      elsif has_downloaded_image || has_new_large_image || has_new_broken_image
        post.trigger_post_process(bypass_bump: true)
      end
    end

    def extract_images_from(html)
      doc = Nokogiri::HTML::fragment(html)
      doc.css("img[src]") - doc.css("img.avatar") - doc.css(".lightbox img[src]")
    end

    def should_download_image?(src)
      # make sure we actually have a url
      return false unless src.present?

      # If file is on the forum or CDN domain
      if Discourse.store.has_been_uploaded?(src) || src =~ /\A\/[^\/]/i
        # Return true if we can't find the upload in the db
        return !Upload.get_from_url(src)
      end

      # Don't download non-local images unless site setting enabled
      return false unless SiteSetting.download_remote_images_to_local?

      # parse the src
      begin
        uri = URI.parse(src)
      rescue URI::Error
        return false
      end

      hostname = uri.hostname
      return false unless hostname

      # check the domains blacklist
      SiteSetting.should_download_images?(src)
    end

    def log(log_level, message)
      Rails.logger.public_send(
        log_level,
        "#{RailsMultisite::ConnectionManagement.current_db}: #{message}"
      )
    end

    private

    def remove_scheme(src)
      src.sub(/^https?:/i, "")
    end
  end

end
