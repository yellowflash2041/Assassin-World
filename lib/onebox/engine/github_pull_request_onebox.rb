# frozen_string_literal: true

require_relative '../mixins/github_body'

module Onebox
  module Engine
    class GithubPullRequestOnebox
      include Engine
      include LayoutSupport
      include JSON
      include Onebox::Mixins::GithubBody

      GITHUB_COMMENT_REGEX = /(<!--.*?-->\r\n)/

      matches_regexp(/^https?:\/\/(?:www\.)?(?:(?:\w)+\.)?(github)\.com(?:\/)?(?:.)*\/pull/)
      always_https

      def url
        "https://api.github.com/repos/#{match[:owner]}/#{match[:repository]}/pulls/#{match[:number]}"
      end

      private

      def match
        @match ||= @url.match(%r{github\.com/(?<owner>[^/]+)/(?<repository>[^/]+)/pull/(?<number>[^/]+)})
      end

      def data
        result = raw.clone
        result['link'] = link

        created_at = Time.parse(result['created_at'])
        result['created_at'] = created_at.strftime("%I:%M%p - %d %b %y %Z")
        result['created_at_date'] = created_at.strftime("%F")
        result['created_at_time'] = created_at.strftime("%T")

        ulink = URI(link)
        result['domain'] = "#{ulink.host}/#{ulink.path.split('/')[1]}/#{ulink.path.split('/')[2]}"

        result['body'], result['excerpt'] = compute_body(result['body'])

        if result['commit'] = load_commit(link)
          result['body'], result['excerpt'] = compute_body(result['commit']['commit']['message'].lines[1..].join)
        elsif result['comment'] = load_comment(link)
          result['body'], result['excerpt'] = compute_body(result['comment']['body'])
        elsif result['discussion'] = load_review(link)
          result['body'], result['excerpt'] = compute_body(result['discussion']['body'])
        else
          result['pr'] = true
        end

        result
      end

      def load_commit(link)
        if commit_match = link.match(/commits\/(\h+)/)
          load_json("https://api.github.com/repos/#{match[:owner]}/#{match[:repository]}/commits/#{commit_match[1]}")
        end
      end

      def load_comment(link)
        if comment_match = link.match(/#issuecomment-(\d+)/)
          load_json("https://api.github.com/repos/#{match[:owner]}/#{match[:repository]}/issues/comments/#{comment_match[1]}")
        end
      end

      def load_review(link)
        if review_match = link.match(/#discussion_r(\d+)/)
          load_json("https://api.github.com/repos/#{match[:owner]}/#{match[:repository]}/pulls/comments/#{review_match[1]}")
        end
      end

      def load_json(url)
        ::MultiJson.load(URI.parse(url).open(read_timeout: timeout))
      end
    end
  end
end
