# frozen_string_literal: true

class FoundUserSerializer < ApplicationSerializer
  attributes :username, :name, :avatar_template

  def include_name?
    SiteSetting.enable_names?
  end
end
