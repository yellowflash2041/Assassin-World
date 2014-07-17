
BadgeGrouping.seed do |g|
  g.id = 1
  g.name = "Getting Started"
  g.position = BadgeGrouping::Position::GettingStarted
end

BadgeGrouping.seed do |g|
  g.id = 2
  g.name = "Community"
  g.position = BadgeGrouping::Position::Community
end

BadgeGrouping.seed do |g|
  g.id = 3
  g.name = "Posting"
  g.position = BadgeGrouping::Position::Posting
end

BadgeGrouping.seed do |g|
  g.id = 4
  g.name = "Trust Level"
  g.position = BadgeGrouping::Position::TrustLevel
end

BadgeGrouping.seed do |g|
  g.id = 5
  g.name = "Other"
  g.position = BadgeGrouping::Position::Other
end

# Trust level system badges.
trust_level_badges = [
  {id: 1, name: "Basic User", type: BadgeType::Bronze},
  {id: 2, name: "Regular User", type: BadgeType::Bronze},
  {id: 3, name: "Leader", type: BadgeType::Silver},
  {id: 4, name: "Elder", type: BadgeType::Gold}
]

trust_level_badges.each do |spec|
  Badge.seed do |b|
    b.id = spec[:id]
    b.default_name = spec[:name]
    b.badge_type_id = spec[:type]
    b.query = Badge::Queries.trust_level(spec[:id])
    b.default_badge_grouping_id = BadgeGrouping::Position::TrustLevel

    # allow title for leader and elder
    b.allow_title = spec[:id] > 2
  end
end

Badge.seed do |b|
  b.id = Badge::Reader
  b.default_name = "Reader"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = false
  b.query = Badge::Queries::Reader
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
  b.auto_revoke = false
end

Badge.seed do |b|
  b.id = Badge::ReadGuidelines
  b.default_name = "Read Guidelines"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = false
  b.query = Badge::Queries::ReadGuidelines
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::FirstLink
  b.default_name = "First Link"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstLink
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::FirstQuote
  b.default_name = "First Quote"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstQuote
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::FirstLike
  b.default_name = "First Like"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstLike
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::FirstFlag
  b.default_name = "First Flag"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = false
  b.query = Badge::Queries::FirstFlag
  b.default_badge_grouping_id = BadgeGrouping::Position::Community
end

Badge.seed do |b|
  b.id = Badge::FirstShare
  b.default_name = "First Share"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstShare
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::Welcome
  b.default_name = "Welcome"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::Welcome
  b.default_badge_grouping_id = BadgeGrouping::Position::Community
end

Badge.seed do |b|
  b.id = Badge::Autobiographer
  b.default_name = "Autobiographer"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.query = Badge::Queries::Autobiographer
  b.default_badge_grouping_id = BadgeGrouping::Position::GettingStarted
end

Badge.seed do |b|
  b.id = Badge::Editor
  b.default_name = "Editor"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.query = Badge::Queries::Editor
  b.default_badge_grouping_id = BadgeGrouping::Position::Community
end

#
# Like system badges.
like_badges = [
  {id: 6, name: "Nice Post", type: BadgeType::Bronze, multiple: true},
  {id: 7, name: "Good Post", type: BadgeType::Silver, multiple: true},
  {id: 8, name: "Great Post", type: BadgeType::Gold, multiple: true}
]

like_badges.each do |spec|
  Badge.seed do |b|
    b.id = spec[:id]
    b.default_name = spec[:name]
    b.badge_type_id = spec[:type]
    b.multiple_grant = spec[:multiple]
    b.target_posts = true
    b.query = Badge::Queries.like_badge(Badge.like_badge_counts[spec[:id]])
    b.default_badge_grouping_id = BadgeGrouping::Position::Posting
  end
end
