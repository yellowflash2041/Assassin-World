class Admin::ScreenedIpAddressesController < Admin::AdminController

  before_filter :fetch_screened_ip_address, only: [:update, :destroy]

  def index
    screened_ip_addresses = ScreenedIpAddress.limit(200).order('match_count desc').to_a
    render_serialized(screened_ip_addresses, ScreenedIpAddressSerializer)
  end

  def create
    screened_ip_address = ScreenedIpAddress.new(allowed_params)
    if screened_ip_address.save
      render_serialized(screened_ip_address, ScreenedIpAddressSerializer)
    else
      render_json_error(screened_ip_address)
    end
  end

  def update
    if @screened_ip_address.update_attributes(allowed_params)
      render json: success_json
    else
      render_json_error(@screened_ip_address)
    end
  end

  def destroy
    @screened_ip_address.destroy
    render json: success_json
  end

  def roll_up
    # 1 - retrieve all subnets that needs roll up
    sql = <<-SQL
      SELECT network(inet(host(ip_address) || './24')) AS ip_range
        FROM screened_ip_addresses
       WHERE action_type = :action_type
         AND family(ip_address) = 4
         AND masklen(ip_address) = 32
    GROUP BY ip_range
      HAVING COUNT(*) >= :min_count
    SQL

    subnets = ScreenedIpAddress.exec_sql(sql,
      action_type: ScreenedIpAddress.actions[:block],
      min_count: SiteSetting.min_ban_entries_for_roll_up).values.flatten

    # 2 - log the call
    StaffActionLogger.new(current_user).log_roll_up(subnets) unless subnets.blank?

    subnets.each do |subnet|
      # 3 - create subnet if not already exists
      ScreenedIpAddress.new(ip_address: subnet).save unless ScreenedIpAddress.where(ip_address: subnet).first

      # 4 - update stats
      sql = <<-SQL
        UPDATE screened_ip_addresses
           SET match_count   = sum_match_count,
               created_at    = min_created_at,
               last_match_at = max_last_match_at
          FROM (
            SELECT SUM(match_count)   AS sum_match_count,
                   MIN(created_at)    AS min_created_at,
                   MAX(last_match_at) AS max_last_match_at
              FROM screened_ip_addresses
             WHERE action_type = :action_type
               AND family(ip_address) = 4
               AND masklen(ip_address) = 32
               AND ip_address << :ip_address
          ) s
         WHERE ip_address = :ip_address
      SQL

      ScreenedIpAddress.exec_sql(sql, action_type: ScreenedIpAddress.actions[:block], ip_address: subnet)

      # 5 - remove old matches
      ScreenedIpAddress.where(action_type: ScreenedIpAddress.actions[:block])
                       .where("family(ip_address) = 4")
                       .where("masklen(ip_address) = 32")
                       .where("ip_address << ?", subnet)
                       .delete_all
    end

    render json: success_json
  end

  private

    def allowed_params
      params.require(:ip_address)
      params.permit(:ip_address, :action_name)
    end

    def fetch_screened_ip_address
      @screened_ip_address = ScreenedIpAddress.find(params[:id])
    end

end
