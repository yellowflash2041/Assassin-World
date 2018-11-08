class WizardStepSerializer < ApplicationSerializer

  attributes :id, :next, :previous, :description, :title, :index, :banner
  has_many :fields, serializer: WizardFieldSerializer, embed: :objects

  def id
    object.id
  end

  def index
    object.index
  end

  def next
    object.next.id if object.next.present?
  end

  def include_next?
    object.next.present?
  end

  def previous
    object.previous.id if object.previous.present?
  end

  def include_previous?
    object.previous.present?
  end

  def i18n_key
    @i18n_key ||= "wizard.step.#{object.id}".underscore
  end

  def translate(sub_key, vars = nil)
    key = "#{i18n_key}.#{sub_key}"
    return nil unless I18n.exists?(key)

    vars.nil? ? I18n.t(key) : I18n.t(key, vars)
  end

  def description
    translate("description", base_path: Discourse.base_path)
  end

  def include_description?
    description.present?
  end

  def title
    translate("title")
  end

  def include_title?
    title.present?
  end

  def banner
    object.banner
  end

  def include_banner?
    object.banner.present?
  end

end
