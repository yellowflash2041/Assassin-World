# frozen_string_literal: true

require_dependency "pretty_text"

class InlineUploads
  PLACEHOLDER = "__replace__"
  PATH_PLACEHOLDER = "__replace_path__"

  UPLOAD_REGEXP_PATTERN = "/original/(\\dX/(?:[a-f0-9]/)*[a-f0-9]{40}[a-z0-9.]*)"
  private_constant :UPLOAD_REGEXP_PATTERN

  def self.process(markdown, on_missing: nil)
    markdown = markdown.dup
    cooked_fragment = Nokogiri::HTML::fragment(PrettyText.cook(markdown, disable_emojis: true))
    link_occurences = []

    cooked_fragment.traverse do |node|
      if node.name == "img"
        # Do nothing
      elsif !(node.children.count == 1 && (node.children[0].name != "img" && node.children[0].children.blank?))
        next
      end

      if seen_link = matched_uploads(node).first
        link_occurences <<
          if (actual_link = (node.attributes["href"]&.value || node.attributes["src"]&.value))
            { link: actual_link, is_valid: true }
          else
            { link: seen_link, is_valid: false }
          end
      end
    end

    raw_matches = []

    match_bbcode_img(markdown) do |match, src, replacement, index|
      raw_matches << [match, src, replacement, index]
    end

    match_md_inline_img(markdown) do |match, src, replacement, index|
      raw_matches << [match, src, replacement, index]
    end

    match_md_reference(markdown) do |match, src, replacement, index|
      raw_matches << [match, src, replacement, index]
    end

    match_img(markdown) do |match, src, replacement, index|
      raw_matches << [match, src, replacement, index]
    end

    match_anchor(markdown) do |match, href, replacement, index|
      raw_matches << [match, href, replacement, index]
    end

    db = RailsMultisite::ConnectionManagement.current_db

    regexps = [
      /(https?:\/\/[a-zA-Z0-9\.\/-]+\/uploads\/#{db}#{UPLOAD_REGEXP_PATTERN})/,
    ]

    if Discourse.store.external?
      regexps << /(https?:#{SiteSetting.Upload.s3_base_url}#{UPLOAD_REGEXP_PATTERN})/
      regexps << /(#{SiteSetting.Upload.s3_cdn_url}#{UPLOAD_REGEXP_PATTERN})/
    end

    regexps.each do |regexp|
      indexes = Set.new

      markdown.scan(/(\n{2,}|\A)#{regexp}$/) do |match|
        if match[1].present?
          index = $~.offset(2)[0]
          indexes << index
          raw_matches << [match[1], match[1], +"![](#{PLACEHOLDER})", index]
        end
      end

      markdown.scan(/^#{regexp}(\s)/) do |match|
        if match[0].present?
          index = $~.offset(0)[0]
          next if indexes.include?(index)
          indexes << index

          raw_matches << [
            match[0],
            match[0],
            +"#{Discourse.base_url}#{PATH_PLACEHOLDER}",
            $~.offset(0)[0]
          ]
        end
      end

      markdown.scan(/\[[^\[\]]*\]: #{regexp}/) do |match|
        if match[0].present?
          index = $~.offset(1)[0]
          next if indexes.include?(index)
          indexes << index
        end
      end

      markdown.scan(/((\n|\s)+)#{regexp}/) do |match|
        if matched_uploads(match[2]).present?
          next if indexes.include?($~.offset(3)[0])

          raw_matches << [
            match[2],
            match[2],
            +"#{Discourse.base_url}#{PATH_PLACEHOLDER}",
            $~.offset(0)[0]
          ]
        end
      end
    end

    raw_matches
      .sort { |a, b| a[3] <=> b[3] }
      .each do |match, link, replace_with, _index|

      node_info = link_occurences.shift
      next unless node_info&.dig(:is_valid)

      if link.include?(node_info[:link])
        begin
          uri = URI(link)
        rescue URI::Error
        end

        if !Discourse.store.external?
          next if uri&.host && uri.host != Discourse.current_hostname
        end

        upload = Upload.get_from_url(link)

        if upload
          replace_with.sub!(PLACEHOLDER, upload.short_url)
          replace_with.sub!(PATH_PLACEHOLDER, upload.short_path)
          markdown.sub!(match, replace_with)
        else
          on_missing.call(link) if on_missing
        end
      end
    end

    markdown
  end

  def self.match_md_inline_img(markdown, external_src: false)
    markdown.scan(/(!?\[([^\[\]]*)\]\(([a-zA-z0-9\.\/:-]+)([ ]*['"]{1}[^\)]*['"]{1}[ ]*)?\))/) do |match|
      if (matched_uploads(match[2]).present? || external_src) && block_given?
        yield(
          match[0],
          match[2],
          +"#{match[0].start_with?("!") ? "!" : ""}[#{match[1]}](#{PLACEHOLDER}#{match[3]})",
          $~.offset(0)[0]
        )
      end
    end
  end

  def self.match_bbcode_img(markdown)
    markdown.scan(/(\[img\]\s?(.+)\s?\[\/img\])/) do |match|
      yield(match[0], match[1], +"![](#{PLACEHOLDER})", $~.offset(0)[0]) if block_given?
    end
  end

  def self.match_md_reference(markdown)
    markdown.scan(/(\[([^\]]+)\]:([ ]+)(\S+))/) do |match|
      if match[3] && matched_uploads(match[3]).present? && block_given?
        yield(
          match[0],
          match[3],
          +"[#{match[1]}]:#{match[2]}#{Discourse.base_url}#{PATH_PLACEHOLDER}",
          $~.offset(0)[0]
        )
      end
    end
  end

  def self.match_anchor(markdown, external_href: false)
    markdown.scan(/((<a[^<]+>)([^<\a>]*?)<\/a>)/) do |match|
      node = Nokogiri::HTML::fragment(match[0]).children[0]
      href =  node.attributes["href"]&.value

      if href && (matched_uploads(href).present? || external_href)
        has_attachment = node.attributes["class"]&.value
        index = $~.offset(0)[0]
        text = match[2].strip.gsub("\n", "").gsub(/ +/, " ")
        text = "#{text}|attachment" if has_attachment

        yield(match[0], href, +"[#{text}](#{PLACEHOLDER})", index) if block_given?
      end
    end
  end

  def self.match_img(markdown, external_src: false)
    markdown.scan(/(<(?!img)[^<>]+\/?>)?(\n*)(([ ]*)<img ([^<>]+)>([ ]*))(\n*)/) do |match|
      node = Nokogiri::HTML::fragment(match[2].strip).children[0]
      src =  node.attributes["src"].value

      if matched_uploads(src).present? || external_src
        text = node.attributes["alt"]&.value
        width = node.attributes["width"]&.value
        height = node.attributes["height"]&.value
        title = node.attributes["title"]&.value
        text = "#{text}|#{width}x#{height}" if width && height
        after_html_tag = match[0].present?

        spaces_before =
          if after_html_tag && !match[0].end_with?("/>")
            (match[3].present? ? match[3] : "  ")
          else
            ""
          end

        replacement = +"#{spaces_before}![#{text}](#{PLACEHOLDER}#{title.present? ? " \"#{title}\"" : ""})"

        if after_html_tag && (num_newlines = match[1].length) <= 1
          replacement.prepend("\n" * (num_newlines == 0 ? 2 : 1))
        end

        if after_html_tag && !match[0].end_with?("/>") && (num_newlines = match[6].length) <= 1
          replacement += ("\n" * (num_newlines == 0 ? 2 : 1))
        end

        match[2].strip! if !after_html_tag

        yield(match[2], src, replacement, $~.offset(0)[0]) if block_given?
      end
    end
  end

  def self.matched_uploads(node)
    matches = []

    regexps = [
      /(upload:\/\/([a-zA-Z0-9]+)[a-z0-9\.]*)/,
      /(\/uploads\/short-url\/([a-zA-Z0-9]+)[a-z0-9\.]*)/,
    ]

    db = RailsMultisite::ConnectionManagement.current_db

    if Discourse.store.external?
      if Rails.configuration.multisite
        regexps << /(#{SiteSetting.Upload.s3_base_url}\/uploads\/#{db}#{UPLOAD_REGEXP_PATTERN})/
        regexps << /(#{SiteSetting.Upload.s3_cdn_url}\/uploads\/#{db}#{UPLOAD_REGEXP_PATTERN})/
      else
        regexps << /(#{SiteSetting.Upload.s3_base_url}#{UPLOAD_REGEXP_PATTERN})/
        regexps << /(#{SiteSetting.Upload.s3_cdn_url}#{UPLOAD_REGEXP_PATTERN})/
        regexps << /(\/uploads\/#{db}#{UPLOAD_REGEXP_PATTERN})/
      end
    else
      regexps << /(\/uploads\/#{db}#{UPLOAD_REGEXP_PATTERN})/
    end

    node = node.to_s

    regexps.each do |regexp|
      node.scan(regexp) do |matched|
        matches << matched[0]
      end
    end

    matches
  end
  private_class_method :matched_uploads
end
