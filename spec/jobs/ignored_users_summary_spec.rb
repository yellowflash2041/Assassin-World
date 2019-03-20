require 'rails_helper'

require_dependency 'jobs/scheduled/ignored_users_summary'

describe Jobs::IgnoredUsersSummary do
  before do
    SiteSetting.ignore_user_enabled = true
    SiteSetting.ignored_users_count_message_threshold = 1
    SiteSetting.ignored_users_message_gap_days = 365
  end

  subject { Jobs::IgnoredUsersSummary.new.execute({}) }

  context "with no ignored users" do
    it "does nothing" do
      subject
      expect { subject }.to_not change { Post.count }
    end
  end

  context "when some ignored users exist" do
    let(:tarek) { Fabricate(:user, username: "tarek") }
    let(:matt) { Fabricate(:user, username: "matt") }
    let(:john) { Fabricate(:user, username: "john") }

    before do
      Fabricate(:ignored_user, user: tarek, ignored_user: matt)
      Fabricate(:ignored_user, user_id: tarek.id, ignored_user_id: john.id)
    end

    context "when no system message exists for the ignored users" do
      context "when threshold is not hit" do
        before do
          SiteSetting.ignored_users_count_message_threshold = 5
        end

        it "does nothing" do
          subject
          expect { subject }.to_not change { Post.count }
        end
      end

      context "when threshold is hit" do
        it "creates a system message" do
          subject
          posts = Post.joins(:topic).where(topics: {
            archetype: Archetype.private_message,
            subtype: TopicSubtype.system_message
          })
          expect(posts.count).to eq(2)
          expect(posts.find { |post| post.raw.include?(matt.username) }).to be_present
          expect(posts.find { |post| post.raw.include?(john.username) }).to be_present
        end
      end
    end

    context "when a system message already exists for the ignored users" do
      context "when threshold is not hit" do
        before do
          SiteSetting.ignored_users_count_message_threshold = 5
        end

        it "does nothing" do
          subject
          expect { subject }.to_not change { Post.count }
        end
      end

      context "when threshold is hit" do
        it "does nothing" do
          subject
          expect { subject }.to_not change { Post.count }
        end
      end
    end
  end
end
