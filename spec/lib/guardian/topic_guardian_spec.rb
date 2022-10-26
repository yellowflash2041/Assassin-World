# frozen_string_literal: true

RSpec.describe TopicGuardian do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:tl3_user) { Fabricate(:leader) }
  fab!(:moderator) { Fabricate(:moderator) }
  fab!(:category) { Fabricate(:category) }
  fab!(:topic) { Fabricate(:topic, category: category) }
  fab!(:private_message_topic) { Fabricate(:private_message_topic) }
  fab!(:group) { Fabricate(:group) }

  before do
    Guardian.enable_topic_can_see_consistency_check
  end

  after do
    Guardian.disable_topic_can_see_consistency_check
  end

  describe '#can_create_shared_draft?' do
    it 'when shared_drafts are disabled' do
      SiteSetting.shared_drafts_min_trust_level = 'admin'

      expect(Guardian.new(admin).can_create_shared_draft?).to eq(false)
    end

    it 'when user is a moderator and access is set to admin' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = 'admin'

      expect(Guardian.new(moderator).can_create_shared_draft?).to eq(false)
    end

    it 'when user is a moderator and access is set to staff' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = 'staff'

      expect(Guardian.new(moderator).can_create_shared_draft?).to eq(true)
    end

    it 'when user is TL3 and access is set to TL2' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = '2'

      expect(Guardian.new(tl3_user).can_create_shared_draft?).to eq(true)
    end
  end

  describe '#can_see_shared_draft?' do
    it 'when shared_drafts are disabled (existing shared drafts)' do
      SiteSetting.shared_drafts_min_trust_level = 'admin'

      expect(Guardian.new(admin).can_see_shared_draft?).to eq(true)
    end

    it 'when user is a moderator and access is set to admin' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = 'admin'

      expect(Guardian.new(moderator).can_see_shared_draft?).to eq(false)
    end

    it 'when user is a moderator and access is set to staff' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = 'staff'

      expect(Guardian.new(moderator).can_see_shared_draft?).to eq(true)
    end

    it 'when user is TL3 and access is set to TL2' do
      SiteSetting.shared_drafts_category = category.id
      SiteSetting.shared_drafts_min_trust_level = '2'

      expect(Guardian.new(tl3_user).can_see_shared_draft?).to eq(true)
    end
  end

  describe '#can_edit_topic?' do
    context 'when the topic is a shared draft' do
      let(:tl2_user) { Fabricate(:user, trust_level: TrustLevel[2])  }

      before do
        SiteSetting.shared_drafts_category = category.id
        SiteSetting.shared_drafts_min_trust_level = '2'
      end

      it 'returns false if the topic is a PM' do
        pm_with_draft = Fabricate(:private_message_topic, category: category)
        Fabricate(:shared_draft, topic: pm_with_draft)

        expect(Guardian.new(tl2_user).can_edit_topic?(pm_with_draft)).to eq(false)
      end

      it 'returns false if the topic is archived' do
        archived_topic = Fabricate(:topic, archived: true, category: category)
        Fabricate(:shared_draft, topic: archived_topic)

        expect(Guardian.new(tl2_user).can_edit_topic?(archived_topic)).to eq(false)
      end

      it 'returns true if a shared draft exists' do
        Fabricate(:shared_draft, topic: topic)

        expect(Guardian.new(tl2_user).can_edit_topic?(topic)).to eq(true)
      end

      it 'returns false if the user has a lower trust level' do
        tl1_user = Fabricate(:user, trust_level: TrustLevel[1])
        Fabricate(:shared_draft, topic: topic)

        expect(Guardian.new(tl1_user).can_edit_topic?(topic)).to eq(false)
      end

      it 'returns true if the shared_draft is from a different category' do
        topic = Fabricate(:topic, category: Fabricate(:category))
        Fabricate(:shared_draft, topic: topic)

        expect(Guardian.new(tl2_user).can_edit_topic?(topic)).to eq(false)
      end
    end
  end

  describe '#can_review_topic?' do
    it 'returns false for TL4 users' do
      tl4_user = Fabricate(:user, trust_level: TrustLevel[4])
      topic = Fabricate(:topic)

      expect(Guardian.new(tl4_user).can_review_topic?(topic)).to eq(false)
    end
  end

  # The test cases here are intentionally kept brief because majority of the cases are already handled by
  # `TopicGuardianCanSeeConsistencyCheck` which we run to ensure that the implementation between `TopicGuardian#can_see_topic_ids`
  # and `TopicGuardian#can_see_topic?` is consistent.
  describe '#can_see_topic_ids' do
    it 'returns the topic ids for the topics which a user is allowed to see' do
      expect(Guardian.new.can_see_topic_ids(topic_ids: [topic.id, private_message_topic.id])).to contain_exactly(
        topic.id
      )

      expect(Guardian.new(user).can_see_topic_ids(topic_ids: [topic.id, private_message_topic.id])).to contain_exactly(
        topic.id
      )

      expect(Guardian.new(moderator).can_see_topic_ids(topic_ids: [topic.id, private_message_topic.id])).to contain_exactly(
        topic.id,
      )

      expect(Guardian.new(admin).can_see_topic_ids(topic_ids: [topic.id, private_message_topic.id])).to contain_exactly(
        topic.id,
        private_message_topic.id
      )
    end

    it 'returns the topic ids for topics which are deleted but user is a category moderator of' do
      SiteSetting.enable_category_group_moderation = true

      category.update!(reviewable_by_group_id: group.id)
      group.add(user)
      topic.update!(category: category)
      topic.trash!(admin)

      topic2 = Fabricate(:topic)
      user2 = Fabricate(:user)

      expect(Guardian.new(user).can_see_topic_ids(topic_ids: [topic.id, topic2.id])).to contain_exactly(
        topic.id,
        topic2.id
      )

      expect(Guardian.new(user2).can_see_topic_ids(topic_ids: [topic.id, topic2.id])).to contain_exactly(
        topic2.id,
      )
    end
  end
end
