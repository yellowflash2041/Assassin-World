# frozen_string_literal: true
require 'execjs'
require 'mini_racer'

class DiscourseJsProcessor
  class TranspileError < StandardError; end

  DISCOURSE_COMMON_BABEL_PLUGINS = [
    'proposal-optional-chaining',
    ['proposal-decorators', { legacy: true } ],
    'transform-template-literals',
    'proposal-class-properties',
    'proposal-class-static-block',
    'proposal-private-property-in-object',
    'proposal-private-methods',
    'proposal-numeric-separator',
    'proposal-logical-assignment-operators',
    'proposal-nullish-coalescing-operator',
    'proposal-json-strings',
    'proposal-optional-catch-binding',
    'transform-parameters',
    'proposal-async-generator-functions',
    'proposal-object-rest-spread',
    'proposal-export-namespace-from',
  ]

  def self.plugin_transpile_paths
    @@plugin_transpile_paths ||= Set.new
  end

  def self.ember_cli?(filename)
    filename.include?("/app/assets/javascripts/discourse/dist/")
  end

  def self.call(input)
    root_path = input[:load_path] || ''
    logical_path = (input[:filename] || '').sub(root_path, '').gsub(/\.(js|es6).*$/, '').sub(/^\//, '')
    data = input[:data]

    if should_transpile?(input[:filename])
      data = transpile(data, root_path, logical_path)
    end

    # add sourceURL until we can do proper source maps
    if !Rails.env.production? && !ember_cli?(input[:filename])
      plugin_name = root_path[/\/plugins\/([\w-]+)\/assets/, 1]
      source_url = if plugin_name
        "plugins/#{plugin_name}/assets/javascripts/#{logical_path}"
      else
        logical_path
      end

      data = "eval(#{data.inspect} + \"\\n//# sourceURL=#{source_url}\");\n"
    end

    { data: data }
  end

  def self.transpile(data, root_path, logical_path, theme_id: nil)
    transpiler = Transpiler.new(skip_module: skip_module?(data))
    transpiler.perform(data, root_path, logical_path, theme_id: theme_id)
  end

  def self.should_transpile?(filename)
    filename ||= ''

    # skip ember cli
    return false if ember_cli?(filename)

    # es6 is always transpiled
    return true if filename.end_with?(".es6") || filename.end_with?(".es6.erb")

    # For .js check the path...
    return false unless filename.end_with?(".js") || filename.end_with?(".js.erb")

    relative_path = filename.sub(Rails.root.to_s, '').sub(/^\/*/, '')

    js_root = "app/assets/javascripts"
    test_root = "test/javascripts"

    return false if relative_path.start_with?("#{js_root}/locales/")
    return false if relative_path.start_with?("#{js_root}/plugins/")

    return true if %w(
      start-discourse
      onpopstate-handler
      google-tag-manager
      google-universal-analytics-v3
      google-universal-analytics-v4
      activate-account
      auto-redirect
      embed-application
      app-boot
    ).any? { |f| relative_path == "#{js_root}/#{f}.js" }

    return true if plugin_transpile_paths.any? { |prefix| relative_path.start_with?(prefix) }

    !!(relative_path =~ /^#{js_root}\/[^\/]+\// ||
      relative_path =~ /^#{test_root}\/[^\/]+\//)
  end

  def self.skip_module?(data)
    !!(data.present? && data =~ /^\/\/ discourse-skip-module$/)
  end

  class Transpiler
    @mutex = Mutex.new
    @ctx_init = Mutex.new

    def self.mutex
      @mutex
    end

    def self.load_file_in_context(ctx, path, wrap_in_module: nil)
      contents = File.read("#{Rails.root}/app/assets/javascripts/#{path}")
      if wrap_in_module
        contents = <<~JS
          define(#{wrap_in_module.to_json}, ["exports", "require", "module"], function(exports, require, module){
            #{contents}
          });
        JS
      end
      ctx.eval(contents, filename: path)
    end

    def self.create_new_context
      # timeout any eval that takes longer than 15 seconds
      ctx = MiniRacer::Context.new(timeout: 15000, ensure_gc_after_idle: 2000)

      # General shims
      ctx.attach("rails.logger.info", proc { |err| Rails.logger.info(err.to_s) })
      ctx.attach("rails.logger.warn", proc { |err| Rails.logger.warn(err.to_s) })
      ctx.attach("rails.logger.error", proc { |err| Rails.logger.error(err.to_s) })
      ctx.eval(<<~JS, filename: "environment-setup.js")
        window = {};
        console = {
          prefix: "[DiscourseJsProcessor] ",
          log: function(...args){ rails.logger.info(console.prefix + args.join(" ")); },
          warn: function(...args){ rails.logger.warn(console.prefix + args.join(" ")); },
          error: function(...args){ rails.logger.error(console.prefix + args.join(" ")); }
        };
      JS

      # define/require support
      load_file_in_context(ctx, "mini-loader.js")

      # Babel
      load_file_in_context(ctx, "node_modules/@babel/standalone/babel.js")
      ctx.eval <<~JS
        globalThis.rawBabelTransform = function(){
          return Babel.transform(...arguments).code;
        }
      JS

      # Template Compiler
      load_file_in_context(ctx, "node_modules/ember-source/dist/ember-template-compiler.js")
      load_file_in_context(ctx, "node_modules/babel-plugin-ember-template-compilation/src/plugin.js", wrap_in_module: "babel-plugin-ember-template-compilation/index")
      load_file_in_context(ctx, "node_modules/babel-plugin-ember-template-compilation/src/expression-parser.js", wrap_in_module: "babel-plugin-ember-template-compilation/expression-parser")
      load_file_in_context(ctx, "node_modules/babel-import-util/src/index.js", wrap_in_module: "babel-import-util")

      # Widget HBS compiler
      widget_hbs_compiler_source = File.read("#{Rails.root}/lib/javascripts/widget-hbs-compiler.js")
      widget_hbs_compiler_source = <<~JS
        define("widget-hbs-compiler", ["exports"], function(exports){
          #{widget_hbs_compiler_source}
        });
      JS
      widget_hbs_compiler_transpiled = ctx.call("rawBabelTransform", widget_hbs_compiler_source, {
        ast: false,
        moduleId: 'widget-hbs-compiler',
        plugins: DISCOURSE_COMMON_BABEL_PLUGINS
      })
      ctx.eval(widget_hbs_compiler_transpiled, filename: "widget-hbs-compiler.js")

      # Raw HBS compiler
      load_file_in_context(ctx, "node_modules/handlebars/dist/handlebars.js", wrap_in_module: "handlebars")

      raw_hbs_transpiled = ctx.call(
        "rawBabelTransform",
        File.read("#{Rails.root}/app/assets/javascripts/discourse-common/addon/lib/raw-handlebars.js"),
        {
          ast: false,
          moduleId: "raw-handlebars",
          plugins: [
            ['transform-modules-amd', { noInterop: true }],
            *DISCOURSE_COMMON_BABEL_PLUGINS
          ]
        }
      )
      ctx.eval(raw_hbs_transpiled, filename: "raw-handlebars.js")

      # Theme template AST transformation plugins
      load_file_in_context(ctx, "discourse-js-processor.js", wrap_in_module: "discourse-js-processor")

      # Make interfaces available via `v8.call`
      ctx.eval <<~JS
        globalThis.compileRawTemplate = require('discourse-js-processor').compileRawTemplate;
        globalThis.transpile = require('discourse-js-processor').transpile;
      JS

      ctx
    end

    def self.reset_context
      @ctx&.dispose
      @ctx = nil
    end

    def self.v8
      return @ctx if @ctx

      # ensure we only init one of these
      @ctx_init.synchronize do
        return @ctx if @ctx
        @ctx = create_new_context
      end

      @ctx
    end

    def self.v8_call(*args, **kwargs)
      mutex.synchronize do
        v8.call(*args, **kwargs)
      end
    rescue MiniRacer::RuntimeError => e
      message = e.message
      begin
        # Workaround for https://github.com/rubyjs/mini_racer/issues/262
        possible_encoded_message = message.delete_prefix("Error: ")
        decoded = JSON.parse("{\"value\": #{possible_encoded_message}}")["value"]
        message = "Error: #{decoded}"
      rescue JSON::ParserError
        message = e.message
      end
      transpile_error = TranspileError.new(message)
      transpile_error.set_backtrace(e.backtrace)
      raise transpile_error
    end

    def initialize(skip_module: false)
      @skip_module = skip_module
    end

    def perform(source, root_path = nil, logical_path = nil, theme_id: nil)
      self.class.v8_call(
        "transpile",
        source,
        {
          skip_module: @skip_module,
          moduleId: module_name(root_path, logical_path),
          filename: logical_path || 'unknown',
          themeId: theme_id,
          commonPlugins: DISCOURSE_COMMON_BABEL_PLUGINS
        }
      )
    end

    def module_name(root_path, logical_path)
      path = nil

      root_base = File.basename(Rails.root)
      # If the resource is a plugin, use the plugin name as a prefix
      if root_path =~ /(.*\/#{root_base}\/plugins\/[^\/]+)\//
        plugin_path = "#{Regexp.last_match[1]}/plugin.rb"

        plugin = Discourse.plugins.find { |p| p.path == plugin_path }
        path = "discourse/plugins/#{plugin.name}/#{logical_path.sub(/javascripts\//, '')}" if plugin
      end

      # We need to strip the app subdirectory to replicate how ember-cli works.
      path || logical_path&.gsub('app/', '')&.gsub('addon/', '')&.gsub('admin/addon', 'admin')
    end

    def compile_raw_template(source, theme_id: nil)
      self.class.v8_call("compileRawTemplate", source, theme_id)
    end

  end
end
