if (Rails.env.production? && SiteSetting.logging_provider == 'lograge') || ENV["ENABLE_LOGRAGE"]
  require 'lograge'

  Rails.application.configure do
    config.lograge.enabled = true

    logstash_formatter = ENV["LOGSTASH_FORMATTER"]

    config.lograge.custom_options = lambda do |event|
      exceptions = %w(controller action format id)

      params = event.payload[:params].except(*exceptions)
      params[:files].map!(&:headers) if params[:files]

      output = {
        params: params,
        database: RailsMultisite::ConnectionManagement.current_db,
      }

      output[:time] = event.time unless logstash_formatter
      output
    end

    if logstash_formatter
      config.lograge.formatter = Lograge::Formatters::Logstash.new
    end
  end
end
