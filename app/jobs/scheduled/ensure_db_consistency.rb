module Jobs
  # various consistency checks
  class EnsureDbConsistency < Jobs::Scheduled
    every 12.hours

    def execute(args)
      TopicUser.ensure_consistency!
      UserVisit.ensure_consistency!
      Group.refresh_automatic_groups!
      Notification.ensure_consistency!
      UserAction.ensure_consistency!
      UserBadge.ensure_consistency!
      # ensure consistent
      UserStat.update_view_counts(13.hours.ago)
    end
  end
end
