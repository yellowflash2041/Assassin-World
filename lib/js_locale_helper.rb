module JsLocaleHelper

  def self.output_locale(locale, translations = nil)

    locale_str = locale.to_s

    translations ||= YAML::load(File.open("#{Rails.root}/config/locales/client.#{locale_str}.yml"))

    # We used to split the admin versus the client side, but it's much simpler to just
    # include both for now due to the small size of the admin section.
    #
    # For now, let's leave it split out in the translation file in case we want to split
    # it again later, so we'll merge the JSON ourselves.
    admin_contents = translations[locale_str].delete('admin_js')
    translations[locale_str]['js'].merge!(admin_contents) if admin_contents.present?
    message_formats = strip_out_message_formats!(translations[locale_str]['js'])

    result = generate_message_format(message_formats, locale_str)

    result << "I18n.translations = #{translations.to_json};\n"
    result << "I18n.locale = '#{locale_str}'\n"
    result
  end

  def self.generate_message_format(message_formats, locale_str)
    formats = message_formats.map{|k,v| k.inspect << " : " << compile_message_format(locale_str ,v)}.join(" , ")

    result = "MessageFormat = {locale: {}};\n"
    result << File.read(Rails.root + "lib/javascripts/locale/#{locale_str}.js") << "\n"

    result << "I18n.messageFormat = (function(formats){
      var f = formats;
      return function(key, options) {
        var fn = f[key];
        if(fn){
          try {
            return fn(options);
          } catch(err) {
            return err.message;
          }
        } else {
          return 'Missing Key: ' + key
        }
        return f[key](options);
      };
    })({#{formats}});"
  end

  def self.compile_message_format(locale, format)
    ctx = V8::Context.new
    ctx.load(Rails.root + 'lib/javascripts/messageformat.js')
    ctx.eval("mf = new MessageFormat('#{locale}');")
    ctx.eval("mf.precompile(mf.parse(#{format.inspect}))")

  rescue V8::Error => e
    message = "Invalid Format: " << e.message
    "function(){ return #{message.inspect};}"
  end

  def self.strip_out_message_formats!(hash, prefix = "", rval = {})
    if Hash === hash
      hash.each do |k,v|
        if Hash === v
          rval.merge!(strip_out_message_formats!(v, prefix + (prefix.length > 0 ? "." : "") << k, rval))
        elsif k.end_with?("_MF")
          rval[prefix + (prefix.length > 0 ? "." : "") << k] = v
          hash.delete(k)
        end
      end
    end
    rval
  end

end
