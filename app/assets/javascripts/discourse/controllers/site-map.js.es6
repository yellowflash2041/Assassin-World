export default Ember.ArrayController.extend(Discourse.HasCurrentUser, {
  itemController: "site-map-category",

  showBadgesLink: function(){return Discourse.SiteSettings.enable_badges;}.property(),
  showAdminLinks: Em.computed.alias('currentUser.staff'),
  flaggedPostsCount: Em.computed.alias("currentUser.site_flagged_posts_count"),

  faqUrl: function() {
    return Discourse.SiteSettings.faq_url ? Discourse.SiteSettings.faq_url : Discourse.getURL('/faq');
  }.property(),

  badgesUrl: Discourse.getURL('/badges'),

  showMobileToggle: Discourse.computed.setting('enable_mobile_theme'),

  mobileViewLinkTextKey: function() {
    return Discourse.Mobile.mobileView ? "desktop_view" : "mobile_view";
  }.property(),

  categories: function() {
    var hideUncategorized = !Discourse.SiteSettings.allow_uncategorized_topics,
        showSubcatList = Discourse.SiteSettings.show_subcategory_list,
        isStaff = Discourse.User.currentProp('staff');
    return Discourse.Category.list().reject(function(c) {
      if (showSubcatList && c.get('parent_category_id')) { return true; }
      if (hideUncategorized && c.get('isUncategorizedCategory') && !isStaff) { return true; }
      return false;
    });
  }.property(),

  actions: {
    toggleMobileView: function() {
      Discourse.Mobile.toggleMobileView();
    }
  }
});
