# frozen_string_literal: true

require "ipaddr"

module Onebox
  module Engine
    class AllowlistedGenericOnebox

      # overwrite the allowlist
      def self.===(other)
        other.is_a?(URI) ? (IPAddr.new(other.hostname) rescue nil).nil? : true
      end

      # ensure we're the last engine to be used
      def self.priority
        Float::INFINITY
      end

      private

      # overwrite to allowlist iframes
      def is_embedded?
        return false unless data[:html] && data[:height]
        return true if AllowlistedGenericOnebox.html_providers.include?(data[:provider_name])

        if data[:html]["iframe"]
          fragment = Nokogiri::HTML5::fragment(data[:html])
          if iframe = fragment.at_css("iframe")
            src = iframe["src"]
            return src.present? && SiteSetting.allowed_iframes.split("|").any? { |url| src.start_with?(url) }
          end
        end

        false
      end

    end
  end
end
