if Rails.env.production?
  # Logster.store.ignore = [
  #   # honestly, Rails should not be logging this, its real noisy
  #   /^ActionController::RoutingError \(No route matches/,
  #   # suppress trackback spam bots
  #   Logster::IgnorePattern.new("Can't verify CSRF token authenticity", { REQUEST_URI: /\/trackback\/$/ })
  # ]

  Logster.config.authorize_callback = lambda{|env|
    user = CurrentUser.lookup_from_env(env)
    user && user.admin
  }
end

# middleware that logs errors sits before multisite
# we need to establish a connection so redis connection is good
# and db connection is good
Logster.config.current_context = lambda{|env,&blk|
  begin
    if Rails.configuration.multisite
      request = Rack::Request.new(env)
      ActiveRecord::Base.connection_handler.clear_active_connections!
      RailsMultisite::ConnectionManagement.establish_connection(:host => request['__ws'] || request.host)
    end
    blk.call
  ensure
    ActiveRecord::Base.connection_handler.clear_active_connections!
  end
}
