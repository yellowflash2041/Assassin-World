require 'open-uri'
require 'nokogiri'
require 'excon'

module Jobs
  class CrawlTopicLink < Jobs::Base

    class ReadEnough < Exception; end

    # Retrieve a header regardless of case sensitivity
    def self.header_for(head, name)
      header = head.headers.detect do |k, v|
        name == k.downcase
      end
      header[1] if header
    end

    def self.request_headers(uri)
      { "User-Agent" => "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1667.0 Safari/537.36",
        "Accept" => "text/html",
        "Host" => uri.host }
    end

    # Follow any redirects that might exist
    def self.final_uri(url, limit=5)
      return if limit < 0

      uri = URI(url)
      return if uri.blank? || uri.host.blank?
      headers = CrawlTopicLink.request_headers(uri)
      head = Excon.head(url, read_timeout: 20, headers: headers)
      if head.status == 200
        uri = nil unless header_for(head, 'content-type') =~ /text\/html/
        return uri
      end

      location = header_for(head, 'location')
      if location
        location = "#{uri.scheme}://#{uri.host}#{location}" if location[0] == "/"
        return final_uri(location, limit - 1)
      end

      nil
    end

    # Fetch the beginning of a HTML document at a url
    def self.fetch_beginning(url)
      # Never crawl in test mode
      return if Rails.env.test?

      uri = final_uri(url)
      return "" unless uri

      result = ""
      streamer = lambda do |chunk, remaining_bytes, total_bytes|
        result << chunk

        # Using exceptions for flow control is really bad, but there really seems to
        # be no sane way to get a stream to stop reading in Excon (or Net::HTTP for
        # that matter!)
        raise ReadEnough.new if result.size > 1024 * 10
      end
      Excon.get(uri.to_s, response_block: streamer, read_timeout: 20, headers: CrawlTopicLink.request_headers(uri))
      result

    rescue ReadEnough
      result
    end

    def execute(args)
      raise Discourse::InvalidParameters.new(:topic_link_id) unless args[:topic_link_id].present?

      begin
        topic_link = TopicLink.where(id: args[:topic_link_id], internal: false, crawled_at: nil).first
        return if topic_link.blank?

        crawled = false

        result = CrawlTopicLink.fetch_beginning(topic_link.url)
        doc = Nokogiri::HTML(result)
        if doc
          title = doc.at('title').try(:inner_text)
          if title.present?
            title.gsub!(/\n/, ' ')
            title.gsub!(/ +/, ' ')
            title.strip!
            if title.present?
              crawled = topic_link.update_attributes(title: title[0..255], crawled_at: Time.now)
            end
          end
        end
      rescue Exception
        # If there was a connection error, do nothing
      ensure
        topic_link.update_column(:crawled_at, Time.now) if !crawled && topic_link.present?
      end
    end

  end
end
