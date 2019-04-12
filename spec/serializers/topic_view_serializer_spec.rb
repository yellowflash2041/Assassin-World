require 'rails_helper'

describe TopicViewSerializer do
  def serialize_topic(topic, user_arg)
    topic_view = TopicView.new(topic.id, user_arg)
    serializer = TopicViewSerializer.new(topic_view, scope: Guardian.new(user_arg), root: false).as_json
    JSON.parse(MultiJson.dump(serializer)).deep_symbolize_keys!
  end

  before do
    # ensure no suggested ids are cached cause that can muck up suggested
    RandomTopicSelector.clear_cache!
  end

  let(:topic) { Fabricate(:topic) }
  let(:user) { Fabricate(:user) }
  let(:admin) { Fabricate(:admin) }

  describe '#featured_link and #featured_link_root_domain' do
    let(:featured_link) { 'http://meta.discourse.org' }

    describe 'when topic featured link is disable' do
      it 'should return the right attributes' do
        topic.update!(featured_link: featured_link)
        SiteSetting.topic_featured_link_enabled = false

        json = serialize_topic(topic, user)

        expect(json[:featured_link]).to eq(nil)
        expect(json[:featured_link_root_domain]).to eq(nil)
      end
    end

    describe 'when topic featured link is enabled' do
      it 'should return the right attributes' do
        topic.update!(featured_link: featured_link)

        json = serialize_topic(topic, user)

        expect(json[:featured_link]).to eq(featured_link)
        expect(json[:featured_link_root_domain]).to eq('discourse.org')
      end
    end
  end

  describe '#suggested_topics' do
    let(:topic2) { Fabricate(:topic) }

    before do
      TopicUser.update_last_read(user, topic2.id, 0, 0, 0)
    end

    describe 'when loading last chunk' do
      it 'should include suggested topics' do
        json = serialize_topic(topic, user)

        expect(json[:suggested_topics].first[:id]).to eq(topic2.id)
      end
    end

    describe 'when not loading last chunk' do
      let(:post) { Fabricate(:post, topic: topic) }
      let(:post2) { Fabricate(:post, topic: topic) }

      it 'should not include suggested topics' do
        post
        post2
        topic_view = TopicView.new(topic.id, user, post_ids: [post.id])
        topic_view.next_page
        json = described_class.new(topic_view, scope: Guardian.new(user), root: false).as_json

        expect(json[:suggested_topics]).to eq(nil)
      end
    end
  end

  describe 'when tags added to private message topics' do
    let(:moderator) { Fabricate(:moderator) }
    let(:tag) { Fabricate(:tag) }
    let(:pm) do
      Fabricate(:private_message_topic, tags: [tag], topic_allowed_users: [
        Fabricate.build(:topic_allowed_user, user: moderator),
        Fabricate.build(:topic_allowed_user, user: user)
      ])
    end

    before do
      SiteSetting.tagging_enabled = true
      SiteSetting.allow_staff_to_tag_pms = true
    end

    it "should not include the tag for normal users" do
      json = serialize_topic(pm, user)
      expect(json[:tags]).to eq(nil)
    end

    it "should include the tag for staff users" do
      [moderator, admin].each do |user|
        json = serialize_topic(pm, user)
        expect(json[:tags]).to eq([tag.name])
      end
    end

    it "should not include the tag if pm tags disabled" do
      SiteSetting.allow_staff_to_tag_pms = false

      [moderator, admin].each do |user|
        json = serialize_topic(pm, user)
        expect(json[:tags]).to eq(nil)
      end
    end
  end

  describe 'with hidden tags' do
    let(:hidden_tag) { Fabricate(:tag, name: 'hidden') }
    let(:staff_tag_group) { Fabricate(:tag_group, permissions: { "staff" => 1 }, tag_names: [hidden_tag.name]) }

    before do
      SiteSetting.tagging_enabled = true
      staff_tag_group
      topic.tags << hidden_tag
    end

    it 'returns hidden tag to staff' do
      json = serialize_topic(topic, admin)
      expect(json[:tags]).to eq([hidden_tag.name])
    end

    it 'does not return hidden tag to non-staff' do
      json = serialize_topic(topic, user)
      expect(json[:tags]).to eq([])
    end
  end

  describe "pending posts" do
    context "when the queue is enabled" do
      before do
        SiteSetting.approve_post_count = 1
      end

      let!(:queued_post) do
        ReviewableQueuedPost.needs_review!(
          topic: topic,
          payload: { raw: "hello my raw contents" },
          created_by: user
        )
      end

      it "returns a pending_posts_count when the queue is enabled" do
        json = serialize_topic(topic, admin)
        expect(json[:queued_posts_count]).to eq(1)
      end

      it "returns a user's pending posts" do
        json = serialize_topic(topic, user)
        expect(json[:queued_posts_count]).to be_nil

        post = json[:pending_posts].find { |p| p[:id] = queued_post.id }
        expect(post[:raw]).to eq("hello my raw contents")
        expect(post).to be_present
      end
    end
  end

  context "without an enabled queue" do
    it "returns nil for the count" do
      json = serialize_topic(topic, admin)
      expect(json[:queued_posts_count]).to be_nil
      expect(json[:pending_posts]).to be_nil
    end
  end

  context "details" do
    it "returns the details object" do
      PostCreator.create!(user, topic_id: topic.id, raw: "this is my post content")
      topic.topic_links.create!(user: user, url: 'https://discourse.org', domain: 'discourse.org', clicks: 100)
      json = serialize_topic(topic, admin)

      details = json[:details]
      expect(details).to be_present
      expect(details[:created_by][:id]).to eq(topic.user_id)
      expect(details[:last_poster][:id]).to eq(user.id)
      expect(details[:notification_level]).to be_present
      expect(details[:can_move_posts]).to eq(true)
      expect(details[:can_flag_topic]).to eq(true)
      expect(details[:links][0][:clicks]).to eq(100)

      participant = details[:participants].find { |p| p[:id] == user.id }
      expect(participant[:post_count]).to eq(1)
    end

    it "returns extra fields for a personal message" do
      group = Fabricate(:group)
      GroupUser.create(group: group, user: user)
      GroupUser.create(group: group, user: admin)

      group2 = Fabricate(:group)
      GroupUser.create(group: group2, user: user)

      pm = Fabricate(:private_message_topic)
      pm.update(archetype: 'private_message')
      pm.topic_allowed_groups.create!(group: group)
      pm.topic_allowed_groups.create!(group: group2)

      json = serialize_topic(pm, admin)

      details = json[:details]
      expect(details[:can_remove_self_id]).to eq(admin.id)
      expect(details[:allowed_users].find { |au| au[:id] == pm.user_id }).to be_present
      expect(details[:allowed_groups].find { |ag| ag[:id] == group.id }).to be_present
    end
  end

end
