require 'spec_helper'
require_dependency 'plugin/instance'

describe Plugin::Instance do

  after do
    DiscoursePluginRegistry.javascripts.clear
    DiscoursePluginRegistry.admin_javascripts.clear
    DiscoursePluginRegistry.server_side_javascripts.clear
    DiscoursePluginRegistry.stylesheets.clear
    DiscoursePluginRegistry.mobile_stylesheets.clear
    DiscoursePluginRegistry.desktop_stylesheets.clear
    DiscoursePluginRegistry.sass_variables.clear
  end

  context "find_all" do
    it "can find plugins correctly" do
      plugins = Plugin::Instance.find_all("#{Rails.root}/spec/fixtures/plugins")
      plugins.count.should == 1
      plugin = plugins[0]

      plugin.name.should == "plugin-name"
      plugin.path.should == "#{Rails.root}/spec/fixtures/plugins/my_plugin/plugin.rb"
    end

    it "does not blow up on missing directory" do
      plugins = Plugin::Instance.find_all("#{Rails.root}/frank_zappa")
      plugins.count.should == 0
    end
  end

  context "register asset" do
    it "does register general css properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("test.css")
      plugin.register_asset("test2.css")

      plugin.send :register_assets!

      DiscoursePluginRegistry.mobile_stylesheets.count.should == 0
      DiscoursePluginRegistry.stylesheets.count.should == 2
    end

    it "registers desktop css properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("test.css", :desktop)
      plugin.send :register_assets!

      DiscoursePluginRegistry.mobile_stylesheets.count.should == 0
      DiscoursePluginRegistry.desktop_stylesheets.count.should == 1
      DiscoursePluginRegistry.stylesheets.count.should == 0
    end

    it "registers mobile css properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("test.css", :mobile)
      plugin.send :register_assets!

      DiscoursePluginRegistry.mobile_stylesheets.count.should == 1
      DiscoursePluginRegistry.stylesheets.count.should == 0
    end

    it "registers desktop css properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("test.css", :desktop)
      plugin.send :register_assets!

      DiscoursePluginRegistry.desktop_stylesheets.count.should == 1
      DiscoursePluginRegistry.stylesheets.count.should == 0
    end


    it "registers sass variable properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("test.css", :variables)
      plugin.send :register_assets!

      DiscoursePluginRegistry.sass_variables.count.should == 1
      DiscoursePluginRegistry.stylesheets.count.should == 0
    end


    it "registers admin javascript properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("my_admin.js", :admin)

      plugin.send :register_assets!

      DiscoursePluginRegistry.admin_javascripts.count.should == 1
      DiscoursePluginRegistry.javascripts.count.should == 0
      DiscoursePluginRegistry.server_side_javascripts.count.should == 0
    end

    it "registers server side javascript properly" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      plugin.register_asset("my_admin.js", :server_side)

      plugin.send :register_assets!

      DiscoursePluginRegistry.server_side_javascripts.count.should == 1
      DiscoursePluginRegistry.javascripts.count.should == 1
      DiscoursePluginRegistry.admin_javascripts.count.should == 0
    end

  end


  context "activate!" do
    it "can activate plugins correctly" do
      plugin = Plugin::Instance.new
      plugin.path = "#{Rails.root}/spec/fixtures/plugins/my_plugin/plugin.rb"
      junk_file = "#{plugin.auto_generated_path}/junk"

      plugin.ensure_directory(junk_file)
      File.open("#{plugin.auto_generated_path}/junk", "w") {|f| f.write("junk")}
      plugin.activate!

      plugin.auth_providers.count.should == 1
      auth_provider = plugin.auth_providers[0]
      auth_provider.authenticator.name.should == 'ubuntu'

      # calls ensure_assets! make sure they are there
      plugin.assets.count.should == 1
      plugin.assets.each do |a, opts|
        File.exists?(a).should be_true
      end

      # ensure it cleans up all crap in autogenerated directory
      File.exists?(junk_file).should be_false
    end

    it "finds all the custom assets" do
      plugin = Plugin::Instance.new
      plugin.path = "#{Rails.root}/spec/fixtures/plugins/my_plugin/plugin.rb"

      plugin.register_asset("test.css")
      plugin.register_asset("test2.scss")
      plugin.register_asset("mobile.css", :mobile)
      plugin.register_asset("desktop.css", :desktop)
      plugin.register_asset("desktop2.css", :desktop)

      plugin.register_asset("variables1.scss", :variables)
      plugin.register_asset("variables2.scss", :variables)

      plugin.register_asset("code.js")

      plugin.register_asset("server_side.js", :server_side)

      plugin.register_asset("my_admin.js", :admin)
      plugin.register_asset("my_admin2.js", :admin)

      plugin.activate!

      DiscoursePluginRegistry.javascripts.count.should == 3
      DiscoursePluginRegistry.admin_javascripts.count.should == 2
      DiscoursePluginRegistry.server_side_javascripts.count.should == 1
      DiscoursePluginRegistry.desktop_stylesheets.count.should == 2
      DiscoursePluginRegistry.sass_variables.count.should == 2
      DiscoursePluginRegistry.stylesheets.count.should == 2
      DiscoursePluginRegistry.mobile_stylesheets.count.should == 1
    end
  end

  context "serialized_current_user_fields" do
    it "correctly serializes custom user fields" do
      DiscoursePluginRegistry.serialized_current_user_fields << "has_car"
      user = Fabricate(:user)
      user.custom_fields["has_car"] = "true"
      user.save!

      payload = JSON.parse(CurrentUserSerializer.new(user, scope: Guardian.new(user)).to_json)
      payload["current_user"]["custom_fields"]["has_car"].should == "true"
    end
  end

  context "register_color_scheme" do
    it "can add a color scheme for the first time" do
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      expect {
        plugin.register_color_scheme("Purple", {primary: 'EEE0E5'})
        plugin.notify_after_initialize
      }.to change { ColorScheme.count }.by(1)
      ColorScheme.where(name: "Purple").should be_present
    end

    it "doesn't add the same color scheme twice" do
      Fabricate(:color_scheme, name: "Halloween")
      plugin = Plugin::Instance.new nil, "/tmp/test.rb"
      expect {
        plugin.register_color_scheme("Halloween", {primary: 'EEE0E5'})
        plugin.notify_after_initialize
      }.to_not change { ColorScheme.count }
    end
  end

end
