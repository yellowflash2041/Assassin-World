import computed from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  @computed("model")
  badgeGroups(model) {
    var sorted = _.sortBy(model, function(badge) {
      var pos = badge.get("badge_grouping.position");
      var type = badge.get("badge_type_id");
      var name = badge.get("name");

      return ("000" + pos).slice(-4) + (10 - type) + name;
    });

    var grouped = [];
    var group = [],
      groupId;

    sorted.forEach(function(badge) {
      if (groupId !== badge.badge_grouping_id) {
        if (group && group.length > 0) {
          grouped.push({
            badges: group,
            badgeGrouping: group[0].badge_grouping
          });
        }
        group = [];
        groupId = badge.badge_grouping_id;
      }
      group.push(badge);
    });

    if (group && group.length > 0) {
      grouped.push({ badges: group, badgeGrouping: group[0].badge_grouping });
    }

    return grouped;
  }
});
