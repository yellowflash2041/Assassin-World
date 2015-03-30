import StringBuffer from 'discourse/mixins/string-buffer';

export default Ember.Component.extend(StringBuffer, {
  rerenderTriggers: ['site.isReadOnly'],

  renderString: function(buffer) {
    let notices = [];

    if (this.site.get("isReadOnly")) {
      notices.push([I18n.t("read_only_mode.enabled"), 'alert-read-only']);
    }

    if (this.siteSettings.disable_emails) {
      notices.push([I18n.t("emails_are_disabled"), 'alert-emails-disabled']);
    }

    if (this.siteSettings.enable_s3_uploads) {
      notices.push([I18n.t("s3_deprecation_warning"), 'alert-s3-deprecation']);
    }

    if (Discourse.User.currentProp('admin') && this.siteSettings.show_create_topics_notice) {
      let topic_count = 0,
          post_count = 0;
      _.each(this.site.get('categories'), function(c) {
        if (!c.get('read_restricted')) {
          topic_count += c.get('topic_count');
          post_count  += c.get('post_count');
        }
      });
      if (topic_count < 5 || post_count < this.siteSettings.tl1_requires_read_posts) {
        notices.push([I18n.t("too_few_topics_notice", { posts: this.siteSettings.tl1_requires_read_posts }), 'alert-too-few-topics']);
      }
    }

    if (!_.isEmpty(this.siteSettings.global_notice)) {
      notices.push([this.siteSettings.global_notice, 'alert-global-notice']);
    }

    if (notices.length > 0) {
      buffer.push(_.map(notices, n => "<div class='row'><div class='alert alert-info " + n[1] + "'>" + n[0] + "</div></div>").join(""));
    }
  }
});
