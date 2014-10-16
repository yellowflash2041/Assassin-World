module Discourse
  # work around reloader
  unless defined? ::Discourse::VERSION
    module VERSION #:nodoc:
      MAJOR = 1
      MINOR = 1
      TINY  = 0
      PRE   = 'beta6b'

      STRING = [MAJOR, MINOR, TINY, PRE].compact.join('.')
    end
  end
end
