Discourse.BlockedEmailsListView = Ember.ListView.extend({
  height: 500,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/blocked_emails_list_item"})
});
