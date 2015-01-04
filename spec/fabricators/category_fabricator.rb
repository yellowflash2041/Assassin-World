Fabricator(:category) do
  name { sequence(:name) { |n| "Amazing Category #{n}" } }
  user
end

Fabricator(:diff_category, from: :category) do
  name "Different Category"
  user
end

Fabricator(:happy_category, from: :category) do
  name 'Happy Category'
  slug 'happy'
  user
end
