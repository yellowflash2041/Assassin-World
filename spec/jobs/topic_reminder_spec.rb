require 'rails_helper'

describe Jobs::TopicReminder do
  let(:admin) { Fabricate(:admin) }
  let(:topic) { Fabricate(:topic, topic_timers: [
    Fabricate(:topic_timer, user: admin, status_type: TopicTimer.types[:reminder])
  ]) }

  before do
    SiteSetting.queue_jobs = true
  end

  it "should be able to create a reminder" do
    topic_timer = topic.topic_timers.first
    Timecop.freeze(1.day.from_now) do
      expect {
        described_class.new.execute(topic_timer_id: topic_timer.id)
      }.to change { Notification.count }.by(1)
      expect( admin.notifications.where(notification_type: Notification.types[:topic_reminder]).first&.topic_id ).to eq(topic.id)
      expect( TopicTimer.where(id: topic_timer.id).first ).to be_nil
    end
  end

  it "does nothing if it was trashed before the scheduled time" do
    topic_timer = topic.topic_timers.first
    topic_timer.trash!(Discourse.system_user)
    Timecop.freeze(1.day.from_now) do
      expect {
        described_class.new.execute(topic_timer_id: topic_timer.id)
      }.to_not change { Notification.count }
    end
  end

  it "does nothing if job runs too early" do
    topic_timer = topic.topic_timers.first
    topic_timer.update_attribute(:execute_at, 8.hours.from_now)
    Timecop.freeze(6.hours.from_now) do
      expect {
        described_class.new.execute(topic_timer_id: topic_timer.id)
      }.to_not change { Notification.count }
    end
  end

  it "does nothing if topic was deleted" do
    topic_timer = topic.topic_timers.first
    topic.trash!
    Timecop.freeze(1.day.from_now) do
      expect {
        described_class.new.execute(topic_timer_id: topic_timer.id)
      }.to_not change { Notification.count }
    end
  end
  
end
