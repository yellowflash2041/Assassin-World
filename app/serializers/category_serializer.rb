class CategorySerializer < BasicCategorySerializer

  attributes :read_restricted,
             :available_groups,
             :auto_close_hours,
             :group_permissions,
             :position,
             :email_in,
             :email_in_allow_strangers,
             :can_delete

  def group_permissions
    @group_permissions ||= begin
      perms = object.category_groups.joins(:group).includes(:group).order("groups.name").map do |cg|
        {
          permission_type: cg.permission_type,
          group_name: cg.group.name
        }
      end
      if perms.length == 0 && !object.read_restricted
        perms << {permission_type: CategoryGroup.permission_types[:full], group_name: :everyone}
      end
      perms
    end
  end

  def available_groups
    Group.order(:name).pluck(:name) - group_permissions.map{|g| g[:group_name]}
  end


  def can_delete
    true
  end

  def include_can_delete?
    scope && scope.can_delete?(object)
  end

  def include_email_in?
    scope && scope.can_edit?(object)
  end

  def include_email_in_allow_strangers?
    scope && scope.can_edit?(object)
  end

end
