import ObjectController from 'discourse/controllers/object';
import { notificationUrl } from 'discourse/lib/desktop-notifications';

export default ObjectController.extend({

  scope: function() {
    return "notifications." + this.site.get("notificationLookup")[this.get("notification_type")];
  }.property("notification_type"),

  username: Em.computed.alias("data.display_username"),

  url: function() {
    return notificationUrl(this);
  }.property("data.{badge_id,badge_name}", "slug", "topic_id", "post_number"),

  description: function() {
    const badgeName = this.get("data.badge_name");
    if (badgeName) { return Handlebars.Utils.escapeExpression(badgeName); }
    return this.blank("data.topic_title") ? "" : Handlebars.Utils.escapeExpression(this.get("data.topic_title"));
  }.property("data.{badge_name,topic_title}")

});
