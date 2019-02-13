require "aws-sdk-sns"

module Jobs

  class ConfirmSnsSubscription < Jobs::Base
    sidekiq_options retry: false

    def execute(args)
      return unless raw  = args[:raw].presence
      return unless json = args[:json].presence

      return unless subscribe_url = json["SubscribeURL"].presence
      return unless Aws::SNS::MessageVerifier.new.authentic?(raw)

      # confirm subscription by visiting the URL
      open(subscribe_url)
    end

  end

end
