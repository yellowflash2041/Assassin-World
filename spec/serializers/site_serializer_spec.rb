# frozen_string_literal: true

require 'rails_helper'

describe SiteSerializer do
  let(:guardian) { Guardian.new }
  let(:category) { Fabricate(:category) }

  it "includes category custom fields only if its preloaded" do
    category.custom_fields["enable_marketplace"] = true
    category.save_custom_fields

    data = MultiJson.dump(described_class.new(Site.new(guardian), scope: guardian, root: false))
    expect(data).not_to include("enable_marketplace")

    Site.preloaded_category_custom_fields << "enable_marketplace"

    data = MultiJson.dump(described_class.new(Site.new(guardian), scope: guardian, root: false))
    expect(data).to include("enable_marketplace")
  end

  it "returns correct notification level for categories" do
    SiteSetting.mute_all_categories_by_default = true
    SiteSetting.default_categories_regular = category.id.to_s

    serialized = described_class.new(Site.new(guardian), scope: guardian, root: false).as_json
    categories = serialized[:categories]
    expect(categories[0][:notification_level]).to eq(0)
    expect(categories[-1][:notification_level]).to eq(1)
  end

  it "includes user-selectable color schemes" do
    scheme = ColorScheme.create_from_base(name: "Neutral", base_scheme_id: "Neutral")
    scheme.user_selectable = true
    scheme.save!

    serialized = described_class.new(Site.new(guardian), scope: guardian, root: false).as_json
    expect(serialized[:user_color_schemes].count).to eq (1)

    dark_scheme = ColorScheme.create_from_base(name: "ADarkScheme", base_scheme_id: "Dark")
    dark_scheme.user_selectable = true
    dark_scheme.save!

    serialized = described_class.new(Site.new(guardian), scope: guardian, root: false).as_json
    expect(serialized[:user_color_schemes].count).to eq(2)
    expect(serialized[:user_color_schemes][0][:is_dark]).to eq(true)
  end

  it "includes default dark mode scheme" do
    scheme = ColorScheme.last
    SiteSetting.default_dark_mode_color_scheme_id = scheme.id
    serialized = described_class.new(Site.new(guardian), scope: guardian, root: false).as_json
    default_dark_scheme =
    expect(serialized[:default_dark_color_scheme]["name"]).to eq(scheme.name)

    SiteSetting.default_dark_mode_color_scheme_id = -1
    serialized = described_class.new(Site.new(guardian), scope: guardian, root: false).as_json
    expect(serialized[:default_dark_color_scheme]).to eq(nil)
  end
end
