# frozen_string_literal: true

require 'maxminddb'
require 'resolv'

class DiscourseIpInfo
  include Singleton

  def initialize
    open_db(File.join(Rails.root, 'vendor', 'data'))
  end

  def open_db(path)
    @loc_mmdb = mmdb_load(File.join(path, 'GeoLite2-City.mmdb'))
    @asn_mmdb = mmdb_load(File.join(path, 'GeoLite2-ASN.mmdb'))
    @cache = LruRedux::ThreadSafeCache.new(2000)
  end

  def self.mmdb_path(name)
    File.join(Rails.root, 'vendor', 'data', "#{name}.mmdb")
  end

  def self.mmdb_download(name)
    require 'rubygems/package'
    require 'zlib'

    uri = URI("https://geolite.maxmind.com/download/geoip/database/#{name}.tar.gz")

    tar_gz_file = Tempfile.new
    begin
      tar_gz_file.binmode
      tar_gz_file.write(Net::HTTP.get(uri))
      tar_gz_file.close

      extractor = Gem::Package::TarReader.new(Zlib::GzipReader.open(tar_gz_file.path))
      extractor.rewind

      extractor.each do |entry|
        next unless entry.full_name.ends_with?(".mmdb")
        File.open(mmdb_path(name), "wb") { |f| f.write(entry.read) }
      end
    ensure
      tar_gz_file.close
      tar_gz_file.unlink
      extractor.close
    end
  end

  def mmdb_load(filepath)
    begin
      MaxMindDB.new(filepath, MaxMindDB::LOW_MEMORY_FILE_READER)
    rescue Errno::ENOENT => e
      Rails.logger.warn("MaxMindDB (#{filepath}) could not be found: #{e}")
      nil
    rescue => e
      Discourse.warn_exception(e, "MaxMindDB (#{filepath}) could not be loaded.")
      nil
    end
  end

  def lookup(ip, locale: :en, resolve_hostname: false)
    ret = {}
    return ret if ip.blank?

    if @loc_mmdb
      begin
        result = @loc_mmdb.lookup(ip)
        if result&.found?
          ret[:country] = result.country.name(locale) || result.country.name
          ret[:country_code] = result.country.iso_code
          ret[:region] = result.subdivisions.most_specific.name(locale) || result.subdivisions.most_specific.name
          ret[:city] = result.city.name(locale) || result.city.name
          ret[:latitude] = result.location.latitude
          ret[:longitude] = result.location.longitude
          ret[:location] = ret.values_at(:city, :region, :country).reject(&:blank?).uniq.join(", ")
        end
      rescue => e
        Discourse.warn_exception(e, message: "IP #{ip} could not be looked up in MaxMind GeoLite2-City database.")
      end
    end

    if @asn_mmdb
      begin
        result = @asn_mmdb.lookup(ip)
        if result&.found?
          result = result.to_hash
          ret[:asn] = result["autonomous_system_number"]
          ret[:organization] = result["autonomous_system_organization"]
        end
      rescue => e
        Discourse.warn_exception(e, message: "IP #{ip} could not be looked up in MaxMind GeoLite2-ASN database.")
      end
    end

    # this can block for quite a while
    # only use it explicitly when needed
    if resolve_hostname
      begin
        result = Resolv::DNS.new.getname(ip)
        ret[:hostname] = result&.to_s
      rescue Resolv::ResolvError
      end
    end

    ret
  end

  def get(ip, locale: :en, resolve_hostname: false)
    ip = ip.to_s
    locale = locale.to_s.sub('_', '-')

    @cache["#{ip}-#{locale}-#{resolve_hostname}"] ||=
      lookup(ip, locale: locale, resolve_hostname: resolve_hostname)
  end

  def self.open_db(path)
    instance.open_db(path)
  end

  def self.get(ip, locale: :en, resolve_hostname: false)
    instance.get(ip, locale: locale, resolve_hostname: resolve_hostname)
  end
end
