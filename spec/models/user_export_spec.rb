# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserExport do
  fab!(:user) { Fabricate(:user) }

  describe '.remove_old_exports' do
    it 'should remove the right records' do
      csv_file_1 = Fabricate(:upload, created_at: 3.days.ago)
      export = UserExport.create!(
        file_name: "test",
        user: user,
        upload_id: csv_file_1.id,
        created_at: 3.days.ago
      )

      csv_file_2 = Fabricate(:upload, created_at: 1.day.ago)
      export2 = UserExport.create!(
        file_name: "test2",
        user: user,
        upload_id: csv_file_2.id,
        created_at: 1.day.ago
      )

      expect do
        UserExport.remove_old_exports
      end.to change { UserExport.count }.by(-1)

      expect(UserExport.exists?(id: export.id)).to eq(false)
      expect(Upload.exists?(id: csv_file_1.id)).to eq(false)
      expect(UserExport.exists?(id: export2.id)).to eq(true)
      expect(Upload.exists?(id: csv_file_2.id)).to eq(true)
    end
  end

  describe '#destroy!' do
    it 'should create post custom field for ignored missing uploads' do
      upload = Fabricate(:upload, created_at: 3.days.ago)
      export = UserExport.create!(
        file_name: "test",
        user: user,
        upload_id: upload.id,
        created_at: 3.days.ago
      )
      post = Fabricate(:post, raw: "![#{upload.original_filename}](#{upload.short_url})")
      post.link_post_uploads

      export.destroy!

      expect(PostCustomField.exists?(post_id: post.id, name: Post::MISSING_UPLOADS_IGNORED)).to eq(true)
    end
  end
end
