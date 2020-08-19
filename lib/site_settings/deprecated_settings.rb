# frozen_string_literal: true

module SiteSettings; end

module SiteSettings::DeprecatedSettings
  SETTINGS = [
    ['show_email_on_profile', 'moderators_view_emails', true, '2.4'],
    ['allow_moderators_to_create_categories', 'moderators_create_categories', true, '2.4'],
    ['disable_edit_notifications', 'disable_system_edit_notifications', true, '2.4'],
    ['enable_category_group_review', 'enable_category_group_moderation', true, '2.7'],
    ['newuser_max_images', 'newuser_max_embedded_media', true, '2.7'],
    ['min_trust_to_post_images', 'min_trust_to_post_embedded_media', true, '2.7'],
    ['moderators_create_categories', 'moderators_manage_categories_and_groups', '2.7']
  ]

  def setup_deprecated_methods
    SETTINGS.each do |old_setting, new_setting, override, version|
      unless override
        SiteSetting.singleton_class.public_send(
          :alias_method, :"_#{old_setting}", :"#{old_setting}"
        )
      end

      define_singleton_method old_setting do |warn: true|
        if warn
          logger.warn(
            "`SiteSetting.#{old_setting}` has been deprecated and will be " +
            "removed in the #{version} Release. Please use " +
            "`SiteSetting.#{new_setting}` instead"
          )
        end

        self.public_send(override ? new_setting : "_#{old_setting}")
      end

      unless override
        SiteSetting.singleton_class.public_send(
          :alias_method, :"_#{old_setting}?", :"#{old_setting}?"
        )
      end

      define_singleton_method "#{old_setting}?" do |warn: true|
        if warn
          logger.warn(
            "`SiteSetting.#{old_setting}?` has been deprecated and will be " +
            "removed in the #{version} Release. Please use " +
            "`SiteSetting.#{new_setting}?` instead"
          )
        end

        self.public_send("#{override ? new_setting : "_" + old_setting}?")
      end

      unless override
        SiteSetting.singleton_class.public_send(
          :alias_method, :"_#{old_setting}=", :"#{old_setting}="
        )
      end

      define_singleton_method "#{old_setting}=" do |val, warn: true|
        if warn
          logger.warn(
            "`SiteSetting.#{old_setting}=` has been deprecated and will be " +
            "removed in the #{version} Release. Please use " +
            "`SiteSetting.#{new_setting}=` instead"
          )
        end

        self.public_send("#{override ? new_setting : "_" + old_setting}=", val)
      end
    end
  end
end
