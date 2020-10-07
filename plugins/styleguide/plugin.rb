# frozen_string_literal: true

# name: styleguide
# about: Preview how Widgets are Styled in Discourse
# version: 0.2
# author: Robin Ward

register_asset "stylesheets/styleguide.scss"
enabled_site_setting :styleguide_enabled

load File.expand_path('../lib/styleguide/engine.rb', __FILE__)

Discourse::Application.routes.append do
  mount ::Styleguide::Engine, at: '/styleguide'
end
