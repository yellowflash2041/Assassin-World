require_dependency 'search'

class SearchController < ApplicationController

  def self.valid_context_types
    %w{user topic category private_messages}
  end

  def query
    params.require(:term)

    search_args = {guardian: guardian}
    search_args[:type_filter] = params[:type_filter] if params[:type_filter].present?
    if params[:include_blurbs].present?
      search_args[:include_blurbs] = params[:include_blurbs] == "true"
    end
    search_args[:search_for_id] = true if params[:search_for_id].present?

    search_context = params[:search_context]
    if search_context.present?
      raise Discourse::InvalidParameters.new(:search_context) unless SearchController.valid_context_types.include?(search_context[:type])
      raise Discourse::InvalidParameters.new(:search_context) if search_context[:id].blank?

      # A user is found by username
      context_obj = nil
      if ['user','private_messages'].include? search_context[:type]
        context_obj = User.find_by(username_lower: params[:search_context][:id].downcase)
      else
        klass = search_context[:type].classify.constantize
        context_obj = klass.find_by(id: params[:search_context][:id])
      end

      if search_context[:type] == 'private_messages'
        search_args[:type_filter] = 'private_messages'
      end

      guardian.ensure_can_see!(context_obj)
      search_args[:search_context] = context_obj
    end

    search = Search.new(params[:term], search_args.symbolize_keys)
    result = search.execute
    render_serialized(result, GroupedSearchResultSerializer, :result => result)
  end

end
