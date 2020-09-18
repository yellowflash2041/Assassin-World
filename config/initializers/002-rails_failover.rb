# frozen_string_literal: true

if defined?(RailsFailover::Redis)
  message_bus_keepalive_interval = nil

  RailsFailover::Redis.on_failover do
    message_bus_keepalive_interval = MessageBus.keepalive_interval
    MessageBus.keepalive_interval = -1 # Disable MessageBus keepalive_interval
    Discourse.received_redis_readonly!
  end

  RailsFailover::Redis.on_fallback do
    Discourse.clear_redis_readonly!
    Discourse.request_refresh!
    MessageBus.keepalive_interval = message_bus_keepalive_interval

    ObjectSpace.each_object(DistributedCache) do |cache|
      cache.clear
    end

    SiteSetting.refresh!
  end

  if Rails.logger.respond_to? :chained
    RailsFailover::Redis.logger = Rails.logger.chained.first
  end
end

if defined?(RailsFailover::ActiveRecord)
  return unless Rails.configuration.active_record_rails_failover

  if Rails.configuration.multisite
    if ActiveRecord::Base.current_role == ActiveRecord::Base.reading_role
      RailsMultisite::ConnectionManagement.default_connection_handler =
        ActiveRecord::Base.connection_handlers[ActiveRecord::Base.reading_role]
    end
  end

  RailsFailover::ActiveRecord.on_failover do
    if RailsMultisite::ConnectionManagement.current_db == RailsMultisite::ConnectionManagement::DEFAULT
      RailsMultisite::ConnectionManagement.each_connection do
        Sidekiq.pause!("pg_failover") if !Sidekiq.paused?
        Discourse.enable_readonly_mode(Discourse::PG_READONLY_MODE_KEY)
      end
    end
  end

  RailsFailover::ActiveRecord.on_fallback do
    RailsMultisite::ConnectionManagement.each_connection do
      Discourse.disable_readonly_mode(Discourse::PG_READONLY_MODE_KEY)
      Sidekiq.unpause! if Sidekiq.paused?
    end

    if Rails.configuration.multisite
      RailsMultisite::ConnectionManagement.default_connection_handler =
        ActiveRecord::Base.connection_handlers[ActiveRecord::Base.writing_role]
    end
  end

  RailsFailover::ActiveRecord.register_force_reading_role_callback do
    Discourse.redis.exists?(
      Discourse::PG_READONLY_MODE_KEY,
      Discourse::PG_FORCE_READONLY_MODE_KEY
    )
  rescue => e
    if !e.is_a?(Redis::CannotConnectError)
      Rails.logger.warn "#{e.class} #{e.message}: #{e.backtrace.join("\n")}"
    end

    false
  end
end
