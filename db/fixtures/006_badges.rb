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
    b.name = spec[:name]
    b.badge_type_id = spec[:type]
    b.query = Badge::Queries.trust_level(spec[:id])

    # allow title for leader and elder
    b.allow_title = spec[:id] > 2
  end
end

Badge.seed do |b|
  b.id = Badge::FirstLink
  b.name = "First Link"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstLink
end

Badge.seed do |b|
  b.id = Badge::FirstLike
  b.name = "First Like"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstLike
end

Badge.seed do |b|
  b.id = Badge::FirstFlag
  b.name = "First Flag"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = false
  b.query = Badge::Queries::FirstFlag
end

Badge.seed do |b|
  b.id = Badge::FirstShare
  b.name = "First Share"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::FirstShare
end

Badge.seed do |b|
  b.id = Badge::Welcome
  b.name = "Welcome"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.target_posts = true
  b.query = Badge::Queries::Welcome
end

Badge.seed do |b|
  b.id = Badge::Autobiographer
  b.name = "Autobiographer"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.query = Badge::Queries::Autobiographer
end

Badge.seed do |b|
  b.id = Badge::Editor
  b.name = "Editor"
  b.badge_type_id = BadgeType::Bronze
  b.multiple_grant = false
  b.query = Badge::Queries::Editor
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
    b.name = spec[:name]
    b.badge_type_id = spec[:type]
    b.multiple_grant = spec[:multiple]
    b.target_posts = true
    b.query = Badge::Queries.like_badge(Badge.like_badge_counts[spec[:id]])
  end
end
