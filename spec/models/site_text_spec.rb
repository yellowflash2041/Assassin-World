require 'spec_helper'

describe SiteText do

  it { should validate_presence_of :value }


  describe "#text_for" do

    it "returns an empty string for a missing text_type" do
      SiteText.text_for('breaking.bad').should == ""
    end

    it "returns the default value for a text` type with a default" do
      SiteText.text_for("usage_tips").should be_present
    end

    context "without replacements" do
      let!(:site_text) { Fabricate(:site_text_basic) }

      it "returns the simple string" do
        SiteText.text_for('breaking.bad').should == "best show ever"
      end

    end

    context "with replacements" do
      let!(:site_text) { Fabricate(:site_text) }
      let(:replacements) { {flower: 'roses', food: 'grapes'} }

      it "returns the correct string with replacements" do
        SiteText.text_for('great.poem', replacements).should == "roses are red. grapes are blue."
      end

      it "doesn't mind extra keys in the replacements" do
        SiteText.text_for('great.poem', replacements.merge(extra: 'key')).should == "roses are red. grapes are blue."
      end

      it "ignores missing keys" do
        SiteText.text_for('great.poem', flower: 'roses').should == "roses are red. %{food} are blue."
      end
    end


    context "replacing site_settings" do
      let!(:site_text) { Fabricate(:site_text_site_setting) }

      it "replaces site_settings by default" do
        SiteSetting.stubs(:title).returns("Evil Trout")
        SiteText.text_for('site.replacement').should == "Evil Trout is evil."
      end

      it "allows us to override the default site settings" do
        SiteSetting.stubs(:title).returns("Evil Trout")
        SiteText.text_for('site.replacement', title: 'Good Tuna').should == "Good Tuna is evil."
      end

    end

  end

end
