require 'rails_helper'
require_dependency 'migration/safe_migrate'

describe Migration::SafeMigrate do
  before do
    Migration::SafeMigrate::SafeMigration.disable_safe!
  end

  after do
    Migration::SafeMigrate.disable!
    Migration::SafeMigrate::SafeMigration.enable_safe!
  end

  def capture_stdout
    old_stdout = $stdout
    io = StringIO.new
    $stdout = io
    yield
    io.string
  ensure
    $stdout = old_stdout
  end

  it "bans all table removal" do
    Migration::SafeMigrate.enable!

    path = File.expand_path "#{Rails.root}/spec/fixtures/migrate/drop_table"

    output = capture_stdout do
      expect(lambda do
        ActiveRecord::Migrator.up([path])
      end).to raise_error(StandardError)
    end

    expect(output).to include("TableDropper")

    expect(User.first).not_to eq(nil)
  end

  it "bans all column removal" do
    Migration::SafeMigrate.enable!

    path = File.expand_path "#{Rails.root}/spec/fixtures/migrate/remove_column"

    output = capture_stdout do
      expect(lambda do
        ActiveRecord::Migrator.up([path])
      end).to raise_error(StandardError)
    end

    expect(output).to include("ColumnDropper")

    expect(User.first).not_to eq(nil)
  end

  it "bans all column renames" do
    Migration::SafeMigrate.enable!

    path = File.expand_path "#{Rails.root}/spec/fixtures/migrate/rename_column"

    output = capture_stdout do
      expect(lambda do
        ActiveRecord::Migrator.up([path])
      end).to raise_error(StandardError)
    end

    expect(output).to include("ColumnDropper")

    expect(User.first).not_to eq(nil)
  end

  it "supports being disabled" do
    Migration::SafeMigrate.enable!
    Migration::SafeMigrate.disable!

    path = File.expand_path "#{Rails.root}/spec/fixtures/migrate/drop_table"

    output = capture_stdout do
      ActiveRecord::Migrator.up([path])
    end

    expect(output).to include("drop_table(:users)")
  end
end
