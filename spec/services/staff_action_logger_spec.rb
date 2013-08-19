require 'spec_helper'

describe StaffActionLogger do

  let(:admin)  { Fabricate(:admin) }
  let(:logger) { described_class.new(admin) }

  describe 'new' do
    it 'raises an error when user is nil' do
      expect { described_class.new(nil) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'raises an error when user is not a User' do
      expect { described_class.new(5) }.to raise_error(Discourse::InvalidParameters)
    end
  end

  describe 'log_user_deletion' do
    let(:deleted_user) { Fabricate(:user) }

    subject(:log_user_deletion) { described_class.new(admin).log_user_deletion(deleted_user) }

    it 'raises an error when user is nil' do
      expect { logger.log_user_deletion(nil) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'raises an error when user is not a User' do
      expect { logger.log_user_deletion(1) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'creates a new StaffActionLog record' do
      expect { log_user_deletion }.to change { StaffActionLog.count }.by(1)
      StaffActionLog.last.target_user_id.should == deleted_user.id
    end
  end

  describe 'log_trust_level_change' do
    let(:user) { Fabricate(:user) }
    let(:old_trust_level) { TrustLevel.levels[:newuser] }
    let(:new_trust_level) { TrustLevel.levels[:basic] }

    subject(:log_trust_level_change) { described_class.new(admin).log_trust_level_change(user, old_trust_level, new_trust_level) }

    it 'raises an error when user or trust level is nil' do
      expect { logger.log_trust_level_change(nil, old_trust_level, new_trust_level) }.to raise_error(Discourse::InvalidParameters)
      expect { logger.log_trust_level_change(user, nil, new_trust_level) }.to raise_error(Discourse::InvalidParameters)
      expect { logger.log_trust_level_change(user, old_trust_level, nil) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'raises an error when user is not a User' do
      expect { logger.log_trust_level_change(1, old_trust_level, new_trust_level) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'raises an error when new trust level is not a Trust Level' do
      max_level = TrustLevel.levels.values.max
      expect { logger.log_trust_level_change(user, old_trust_level, max_level + 1) }.to raise_error(Discourse::InvalidParameters)
    end

    it 'creates a new StaffActionLog record' do
      expect { log_trust_level_change }.to change { StaffActionLog.count }.by(1)
      StaffActionLog.last.details.should include "new trust level: #{new_trust_level}"
    end
  end

  describe "log_site_setting_change" do
    it "raises an error when params are invalid" do
      SiteSetting.stubs(:respond_to?).with('abc').returns(false)
      expect { logger.log_site_setting_change(nil, '1', '2') }.to raise_error(Discourse::InvalidParameters)
      expect { logger.log_site_setting_change('abc', '1', '2') }.to raise_error(Discourse::InvalidParameters)
    end

    it "creates a new StaffActionLog record" do
      expect { logger.log_site_setting_change('title', 'Discourse', 'My Site') }.to change { StaffActionLog.count }.by(1)
    end
  end
end
