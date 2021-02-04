# frozen_string_literal: true

require_dependency 'stylesheet/common'
require_dependency 'global_path'

module Stylesheet
  class Importer < SassC::Importer
    include GlobalPath

    THEME_TARGETS ||= %w{embedded_theme mobile_theme desktop_theme}

    def self.special_imports
      @special_imports ||= {}
    end

    def self.register_import(name, &blk)
      special_imports[name] = blk
    end

    # Contained in function so that it can be called repeatedly from test mode
    def self.register_imports!
      @special_imports = {}

      Discourse.plugins.each do |plugin|
        plugin_directory_name = plugin.directory_name

        ["", "mobile", "desktop"].each do |type|
          asset_name = type.present? ? "#{plugin_directory_name}_#{type}" : plugin_directory_name
          stylesheets = type.present? ? DiscoursePluginRegistry.send("#{type}_stylesheets") : DiscoursePluginRegistry.stylesheets

          if stylesheets[plugin_directory_name].present?
            register_import asset_name do
              import_files(stylesheets[plugin_directory_name])
            end
          end
        end
      end

      register_import "font" do
        body_font = DiscourseFonts.fonts.find { |f| f[:key] == SiteSetting.base_font }
        heading_font = DiscourseFonts.fonts.find { |f| f[:key] == SiteSetting.heading_font }
        contents = +""

        if body_font.present?
          contents << <<~EOF
            #{font_css(body_font)}

            :root {
              --font-family: #{body_font[:stack]};
            }
          EOF
        end

        if heading_font.present?
          contents << <<~EOF
            #{font_css(heading_font)}

            :root {
              --heading-font-family: #{heading_font[:stack]};
            }
          EOF
        end

        Import.new("font.scss", source: contents)
      end

      register_import "wizard_fonts" do
        contents = +""

        DiscourseFonts.fonts.each do |font|
          if font[:key] == "system"
            # Overwrite font definition because the preview canvases in the wizard require explicit @font-face definitions.
            # uses same technique as https://github.com/jonathantneal/system-font-css
            font[:variants] = [
              { src: 'local(".SFNS-Regular"), local(".SFNSText-Regular"), local(".HelveticaNeueDeskInterface-Regular"), local(".LucidaGrandeUI"), local("Segoe UI"), local("Ubuntu"), local("Roboto-Regular"), local("DroidSans"), local("Tahoma")', weight: 400 },
              { src: 'local(".SFNS-Bold"), local(".SFNSText-Bold"), local(".HelveticaNeueDeskInterface-Bold"), local(".LucidaGrandeUI"), local("Segoe UI Bold"), local("Ubuntu Bold"), local("Roboto-Bold"), local("DroidSans-Bold"), local("Tahoma Bold")', weight: 700 }
            ]
          end

          contents << font_css(font)
          contents << <<~EOF
            .body-font-#{font[:key].tr("_", "-")} {
              font-family: #{font[:stack]};
            }
            .heading-font-#{font[:key].tr("_", "-")} h2 {
              font-family: #{font[:stack]};
            }
          EOF
        end

        Import.new("wizard_fonts.scss", source: contents)
      end

      register_import "plugins_variables" do
        import_files(DiscoursePluginRegistry.sass_variables)
      end

      register_import "theme_colors" do
        contents = +""
        if @color_scheme_id
          colors = begin
            ColorScheme.find(@color_scheme_id).resolved_colors
          rescue
            ColorScheme.base_colors
          end
        else
          colors = (@theme_id && theme.color_scheme) ? theme.color_scheme.resolved_colors : ColorScheme.base_colors
        end

        colors.each do |n, hex|
          contents << "$#{n}: ##{hex} !default;\n"
        end

        Import.new("theme_colors.scss", source: contents)
      end

      register_import "category_backgrounds" do
        contents = +""
        Category.where('uploaded_background_id IS NOT NULL').each do |c|
          contents << category_css(c) if c.uploaded_background&.url.present?
        end

        Import.new("category_background.scss", source: contents)
      end

    end

    register_imports!

    def self.import_color_definitions(theme_id)
      contents = +""
      DiscoursePluginRegistry.color_definition_stylesheets.each do |name, path|
        contents << "// Color definitions from #{name}\n\n"
        contents << File.read(path.to_s)
        contents << "\n\n"
      end

      theme_id ||= SiteSetting.default_theme_id
      resolved_ids = Theme.transform_ids([theme_id])

      if resolved_ids
        theme = Theme.find_by_id(theme_id)
        contents << theme&.scss_variables.to_s
        Theme.list_baked_fields(resolved_ids, :common, :color_definitions).each do |field|
          contents << "// Color definitions from #{field.theme.name}\n\n"

          if field.theme_id == theme.id
            contents << field.value
          else
            contents << field.compiled_css
          end
          contents << "\n\n"
        end
      end
      contents
    end

    def self.import_wcag_overrides(color_scheme_id)
      if color_scheme_id && ColorScheme.find_by_id(color_scheme_id)&.is_wcag?
        return "@import \"wcag\";"
      end
      ""
    end

    def initialize(options)
      @theme = options[:theme]
      @theme_id = options[:theme_id]
      @color_scheme_id = options[:color_scheme_id]

      if @theme && !@theme_id
        # make up an id so other stuff does not bail out
        @theme_id = @theme.id || -1
      end
    end

    def import_files(files)
      files.map do |file|
        # we never want inline css imports, they are a mess
        # this tricks libsass so it imports inline instead
        if file =~ /\.css$/
          file = file[0..-5]
        end
        Import.new(file)
      end
    end

    def theme_import(target)
      attr = target == :embedded_theme ? :embedded_scss : :scss
      target = target.to_s.gsub("_theme", "").to_sym

      contents = +""

      fields = theme.list_baked_fields(target, attr)
      fields.map do |field|
        value = field.value
        if value.present?
          filename = "theme_#{field.theme.id}/#{field.target_name}-#{field.name}-#{field.theme.name.parameterize}.scss"
          contents << <<~COMMENT
          // Theme: #{field.theme.name}
          // Target: #{field.target_name} #{field.name}
          // Last Edited: #{field.updated_at}
          COMMENT

          if field.theme_id == theme.id
            contents << value
          else
            contents << field.compiled_css
          end
        end

      end
      contents
    end

    def theme
      unless @theme
        @theme = (@theme_id && Theme.find(@theme_id)) || :nil
      end
      @theme == :nil ? nil : @theme
    end

    def category_css(category)
      full_slug = category.full_slug.split("-")[0..-2].join("-")
      "body.category-#{full_slug} { background-image: url(#{upload_cdn_path(category.uploaded_background.url)}) }\n"
    end

    def font_css(font)
      contents = +""

      if font[:variants].present?
        font[:variants].each do |variant|
          src = variant[:src] ? variant[:src] : "asset-url(\"/fonts/#{variant[:filename]}?v=#{DiscourseFonts::VERSION}\") format(\"#{variant[:format]}\")"
          contents << <<~EOF
            @font-face {
              font-family: #{font[:name]};
              src: #{src};
              font-weight: #{variant[:weight]};
            }
          EOF
        end
      end

      contents
    end

    def imports(asset, parent_path)
      if callback = Importer.special_imports[asset]
        instance_eval(&callback)
      else
        Import.new(asset + ".scss")
      end
    end
  end
end
