# frozen_string_literal: true

RSpec.describe ThemeJavascriptCompiler do
  let(:compiler) { ThemeJavascriptCompiler.new(1, 'marks') }

  describe "#append_raw_template" do
    it 'uses the correct template paths' do
      template = "<h1>hello</h1>"
      name = "/path/to/templates1"
      compiler.append_raw_template("#{name}.raw", template)
      expect(compiler.raw_content.to_s).to include("addRawTemplate(\"#{name}\"")

      name = "/path/to/templates2"
      compiler.append_raw_template("#{name}.hbr", template)
      expect(compiler.raw_content.to_s).to include("addRawTemplate(\"#{name}\"")

      name = "/path/to/templates3"
      compiler.append_raw_template("#{name}.hbs", template)
      expect(compiler.raw_content.to_s).to include("addRawTemplate(\"#{name}.hbs\"")
    end
  end

  describe "#append_ember_template" do
    it 'maintains module names so that discourse-boot.js can correct them' do
      compiler.append_ember_template("/connectors/blah-1", "{{var}}")
      expect(compiler.raw_content.to_s).to include("define(\"discourse/theme-1/connectors/blah-1\", [\"exports\", \"@ember/template-factory\"]")

      compiler.append_ember_template("connectors/blah-2", "{{var}}")
      expect(compiler.raw_content.to_s).to include("define(\"discourse/theme-1/connectors/blah-2\", [\"exports\", \"@ember/template-factory\"]")

      compiler.append_ember_template("javascripts/connectors/blah-3", "{{var}}")
      expect(compiler.raw_content.to_s).to include("define(\"discourse/theme-1/javascripts/connectors/blah-3\", [\"exports\", \"@ember/template-factory\"]")
    end
  end

  describe "connector module name handling" do
    it 'separates colocated connectors to avoid module name clash' do
      # Colocated under `/connectors`
      compiler = ThemeJavascriptCompiler.new(1, 'marks')
      compiler.append_tree({
        "connectors/outlet/blah-1.hbs" => "{{var}}",
        "connectors/outlet/blah-1.js" => "console.log('test')"
      })
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/connectors/outlet/blah-1")
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/templates/connectors/outlet/blah-1")
      expect(JSON.parse(compiler.source_map)["sources"]).to contain_exactly("connectors/outlet/blah-1.js", "templates/connectors/outlet/blah-1.js")

      # Colocated under `/templates/connectors`
      compiler = ThemeJavascriptCompiler.new(1, 'marks')
      compiler.append_tree({
        "templates/connectors/outlet/blah-1.hbs" => "{{var}}",
        "templates/connectors/outlet/blah-1.js" => "console.log('test')"
      })
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/connectors/outlet/blah-1")
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/templates/connectors/outlet/blah-1")
      expect(JSON.parse(compiler.source_map)["sources"]).to contain_exactly("connectors/outlet/blah-1.js", "templates/connectors/outlet/blah-1.js")

      # Not colocated
      compiler = ThemeJavascriptCompiler.new(1, 'marks')
      compiler.append_tree({
        "templates/connectors/outlet/blah-1.hbs" => "{{var}}",
        "connectors/outlet/blah-1.js" => "console.log('test')"
      })
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/connectors/outlet/blah-1")
      expect(compiler.raw_content.to_s).to include("discourse/theme-1/templates/connectors/outlet/blah-1")
      expect(JSON.parse(compiler.source_map)["sources"]).to contain_exactly("connectors/outlet/blah-1.js", "templates/connectors/outlet/blah-1.js")
    end
  end

  describe "error handling" do
    it "handles syntax errors in raw templates" do
      expect do
        compiler.append_raw_template("sometemplate.hbr", "{{invalidtemplate")
      end.to raise_error(ThemeJavascriptCompiler::CompileError, /Parse error on line 1/)
    end

    it "handles syntax errors in ember templates" do
      expect do
        compiler.append_ember_template("sometemplate", "{{invalidtemplate")
      end.to raise_error(ThemeJavascriptCompiler::CompileError, /Parse error on line 1/)
    end
  end

  describe "#append_tree" do
    it "can handle multiple modules" do
      compiler.append_tree(
        {
          "discourse/components/mycomponent.js" => <<~JS,
            import Component from "@glimmer/component";
            export default class MyComponent extends Component {}
          JS
          "discourse/templates/components/mycomponent.hbs" => "{{my-component-template}}"
        }
      )
      expect(compiler.raw_content).to include('define("discourse/theme-1/components/mycomponent"')
      expect(compiler.raw_content).to include('define("discourse/theme-1/discourse/templates/components/mycomponent"')
    end

    it "handles colocated components" do
      compiler.append_tree(
        {
          "discourse/components/mycomponent.js" => <<~JS,
            import Component from "@glimmer/component";
            export default class MyComponent extends Component {}
          JS
          "discourse/components/mycomponent.hbs" => "{{my-component-template}}"
        }
      )
      expect(compiler.raw_content).to include("__COLOCATED_TEMPLATE__ =")
      expect(compiler.raw_content).to include("setComponentTemplate")
    end

    it "prints error when default export missing" do
      compiler.append_tree(
        {
          "discourse/components/mycomponent.js" => <<~JS,
            import Component from "@glimmer/component";
            class MyComponent extends Component {}
          JS
          "discourse/components/mycomponent.hbs" => "{{my-component-template}}"
        }
      )
      expect(compiler.raw_content).to include("__COLOCATED_TEMPLATE__ =")
      expect(compiler.raw_content).to include("throw new Error")
    end

    it "handles template-only components" do
      compiler.append_tree(
        {
          "discourse/components/mycomponent.hbs" => "{{my-component-template}}"
        }
      )
      expect(compiler.raw_content).to include("__COLOCATED_TEMPLATE__ =")
      expect(compiler.raw_content).to include("setComponentTemplate")
      expect(compiler.raw_content).to include("@ember/component/template-only")
    end
  end

  describe "terser compilation" do
    it "applies terser and provides sourcemaps" do
      sources = {
        "multiply.js" => "let multiply = (firstValue, secondValue) => firstValue * secondValue;",
        "add.js" => "let add = (firstValue, secondValue) => firstValue + secondValue;"
      }

      compiler.append_tree(sources)

      expect(compiler.content).to include("multiply")
      expect(compiler.content).to include("add")

      map = JSON.parse(compiler.source_map)
      expect(map["sources"]).to contain_exactly(*sources.keys)
      expect(map["sourcesContent"].to_s).to include("let multiply")
      expect(map["sourcesContent"].to_s).to include("let add")
      expect(map["sourceRoot"]).to eq("theme-1/")
    end

    it "handles invalid JS" do
      compiler.append_raw_script("filename.js", "if(someCondition")
      expect(compiler.content).to include('console.error("[THEME 1')
      expect(compiler.content).to include('Unexpected token')
    end
  end
end
