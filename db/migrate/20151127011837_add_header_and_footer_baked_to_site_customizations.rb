class AddHeaderAndFooterBakedToSiteCustomizations < ActiveRecord::Migration
  def change
    add_column :site_customizations, :header_baked, :text
    add_column :site_customizations, :mobile_header_baked, :text
    add_column :site_customizations, :footer_baked, :text
    add_column :site_customizations, :mobile_footer_baked, :text
  end
end
