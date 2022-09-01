# frozen_string_literal: true

class ThemeJavascriptCompiler

  COLOCATED_CONNECTOR_REGEX = /\A(?<prefix>.*)\/connectors\/(?<outlet>[^\/]+)\/(?<name>[^\/\.]+)\z/

  class CompileError < StandardError
  end

  attr_accessor :content

  def initialize(theme_id, theme_name)
    @theme_id = theme_id
    @content = +""
    @theme_name = theme_name
  end

  def prepend_settings(settings_hash)
    @content.prepend <<~JS
      (function() {
        if ('require' in window) {
          require("discourse/lib/theme-settings-store").registerSettings(#{@theme_id}, #{settings_hash.to_json});
        }
      })();
    JS
  end

  def append_ember_template(name, hbs_template)
    name = "/#{name}" if !name.start_with?("/")
    module_name = "discourse/theme-#{@theme_id}#{name}"

    # Some themes are colocating connector JS under `/connectors`. Move template to /templates to avoid module name clash
    if (match = COLOCATED_CONNECTOR_REGEX.match(module_name)) && !match[:prefix].end_with?("/templates")
      module_name = "#{match[:prefix]}/templates/connectors/#{match[:outlet]}/#{match[:name]}"
    end

    # Mimics the ember-cli implementation
    # https://github.com/ember-cli/ember-cli-htmlbars/blob/d5aa14b3/lib/template-compiler-plugin.js#L18-L26
    script = <<~JS
      import { hbs } from 'ember-cli-htmlbars';
      export default hbs(#{hbs_template.to_json}, { moduleName: #{module_name.to_json} });
    JS

    template_module = DiscourseJsProcessor.transpile(script, "", module_name, theme_id: @theme_id)
    content << <<~JS
      if ('define' in window) {
      #{template_module}
      }
    JS
  rescue MiniRacer::RuntimeError, DiscourseJsProcessor::TranspileError => ex
    raise CompileError.new ex.message
  end

  def raw_template_name(name)
    name = name.sub(/\.(raw|hbr)$/, '')
    name.inspect
  end

  def append_raw_template(name, hbs_template)
    compiled = DiscourseJsProcessor::Transpiler.new.compile_raw_template(hbs_template, theme_id: @theme_id)
    @content << <<~JS
      (function() {
        const addRawTemplate = requirejs('discourse-common/lib/raw-templates').addRawTemplate;
        const template = requirejs('discourse-common/lib/raw-handlebars').template(#{compiled});
        addRawTemplate(#{raw_template_name(name)}, template);
      })();
    JS
  rescue MiniRacer::RuntimeError, DiscourseJsProcessor::TranspileError => ex
    raise CompileError.new ex.message
  end

  def append_raw_script(script)
    @content << script + "\n"
  end

  def append_module(script, name, include_variables: true)
    name = "discourse/theme-#{@theme_id}/#{name.gsub(/^discourse\//, '')}"

    # Some themes are colocating connector JS under `/templates/connectors`. Move out of templates to avoid module name clash
    if (match = COLOCATED_CONNECTOR_REGEX.match(name)) && match[:prefix].end_with?("/templates")
      name = "#{match[:prefix].delete_suffix("/templates")}/connectors/#{match[:outlet]}/#{match[:name]}"
    end

    script = "#{theme_settings}#{script}" if include_variables
    transpiler = DiscourseJsProcessor::Transpiler.new
    @content << <<~JS
      if ('define' in window) {
      #{transpiler.perform(script, "", name).strip}
      }
    JS
  rescue MiniRacer::RuntimeError, DiscourseJsProcessor::TranspileError => ex
    raise CompileError.new ex.message
  end

  def append_js_error(message)
    @content << "console.error('Theme Transpilation Error:', #{message.inspect});"
  end

  private

  def theme_settings
    <<~JS
      const settings = require("discourse/lib/theme-settings-store")
        .getObjectForTheme(#{@theme_id});
      const themePrefix = (key) => `theme_translations.#{@theme_id}.${key}`;
    JS
  end
end
