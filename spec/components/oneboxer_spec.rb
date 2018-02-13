require 'rails_helper'
require_dependency 'oneboxer'

describe Oneboxer do

  it "returns blank string for an invalid onebox" do
    stub_request(:get, "http://boom.com").to_return(body: "")
    stub_request(:head, "http://boom.com").to_return(body: "")

    expect(Oneboxer.preview("http://boom.com")).to eq("")
    expect(Oneboxer.onebox("http://boom.com")).to eq("")
  end

  context "local oneboxes" do

    def link(url)
      url = "#{Discourse.base_url}#{url}"
      %{<a href="#{url}">#{url}</a>}
    end

    def preview(url, user, category = Category.first)
      Oneboxer.preview("#{Discourse.base_url}#{url}", user_id: user.id, category_id: category.id).to_s
    end

    it "links to a topic/post" do
      staff = Fabricate(:user)
      Group[:staff].add(staff)

      secured_category = Fabricate(:category)
      secured_category.permissions = { staff: :full }
      secured_category.save!

      public_post   = Fabricate(:post)
      public_topic  = public_post.topic
      public_reply  = Fabricate(:post, topic: public_topic, post_number: 2)
      public_hidden = Fabricate(:post, topic: public_topic, post_number: 3, hidden: true)

      user = public_post.user
      public_category = public_topic.category

      secured_topic = Fabricate(:topic, user: staff, category: secured_category)
      secured_post  = Fabricate(:post, user: staff, topic: secured_topic)
      secured_reply = Fabricate(:post, user: staff, topic: secured_topic, post_number: 2)

      expect(preview(public_topic.relative_url, user, public_category)).to include(public_topic.title)
      expect(preview(public_post.url, user, public_category)).to include(public_topic.title)
      expect(preview(public_reply.url, user, public_category)).to include(public_reply.cooked)
      expect(preview(public_hidden.url, user, public_category)).to match_html(link(public_hidden.url))
      expect(preview(secured_topic.relative_url, user, public_category)).to match_html(link(secured_topic.relative_url))
      expect(preview(secured_post.url, user, public_category)).to match_html(link(secured_post.url))
      expect(preview(secured_reply.url, user, public_category)).to match_html(link(secured_reply.url))

      expect(preview(public_topic.relative_url, user, secured_category)).to match_html(link(public_topic.relative_url))
      expect(preview(public_reply.url, user, secured_category)).to match_html(link(public_reply.url))
      expect(preview(secured_post.url, user, secured_category)).to match_html(link(secured_post.url))
      expect(preview(secured_reply.url, user, secured_category)).to match_html(link(secured_reply.url))

      expect(preview(public_topic.relative_url, staff, secured_category)).to include(public_topic.title)
      expect(preview(public_post.url, staff, secured_category)).to include(public_topic.title)
      expect(preview(public_reply.url, staff, secured_category)).to include(public_reply.cooked)
      expect(preview(public_hidden.url, staff, secured_category)).to match_html(link(public_hidden.url))
      expect(preview(secured_topic.relative_url, staff, secured_category)).to include(secured_topic.title)
      expect(preview(secured_post.url, staff, secured_category)).to include(secured_topic.title)
      expect(preview(secured_reply.url, staff, secured_category)).to include(secured_reply.cooked)
    end

    it "links to an user profile" do
      user = Fabricate(:user)

      expect(preview("/u/does-not-exist", user)).to match_html(link("/u/does-not-exist"))
      expect(preview("/u/#{user.username}", user)).to include(user.name)
    end

    it "links to an upload" do
      user = Fabricate(:user)
      path = "/uploads/default/original/3X/e/8/e8fcfa624e4fb6623eea57f54941a58ba797f14d"

      expect(preview("#{path}.pdf", user)).to match_html(link("#{path}.pdf"))
      expect(preview("#{path}.MP3", user)).to include("<audio ")
      expect(preview("#{path}.mov", user)).to include("<video ")
    end

  end

end
