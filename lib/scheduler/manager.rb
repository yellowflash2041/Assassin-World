# Initially we used sidetiq, this was a problem:
#
# 1. No mechnism to add "randomisation" into job execution
# 2. No stats about previous runs or failures
# 3. Dependency on ice_cube gem causes runaway CPU

module Scheduler
  class Manager
    attr_accessor :random_ratio, :redis


    class Runner
      def initialize(manager)
        @queue = Queue.new
        @manager = manager
        @thread = Thread.new do
          while true
            klass = @queue.deq
            failed = false
            start = Time.now.to_f
            begin
              klass.new.perform
            rescue
              failed = true
            end
            duration = ((Time.now.to_f - start) * 1000).to_i
            info = @manager.schedule_info(klass)
            info.prev_duration = duration
            info.prev_result = failed ? "FAILED" : "OK"
            info.write!
          end
        end
      end

      def stop!
        @thread.kill
      end

      def enq(klass)
        @queue << klass
      end

      def wait_till_done
        while !@queue.empty? && !@queue.num_waiting == 1
          sleep 0.001
        end
      end
    end

    def initialize(redis = nil)
      @redis = $redis || redis
      @random_ratio = 0.1
      @runner = Runner.new(self)
      @manager_id = SecureRandom.hex
    end

    def schedule_info(klass)
      ScheduleInfo.new(klass, self)
    end

    def next_run(klass)
      schedule_info(klass).next_run
    end

    def ensure_schedule!(klass)
      lock do
        schedule_info(klass).schedule!
      end

    end

    def remove(klass)
      lock do
        schedule_info(klass).del!
      end
    end

    def tick
      lock do
        (key, due), _ = redis.zrange Manager.queue_key, 0, 0, withscores: true
        if due.to_i <= Time.now.to_i
          klass = key.constantize
          info = schedule_info(klass)
          info.prev_run = Time.now.to_i
          info.next_run = nil
          info.schedule!
          @runner.enq(klass)
        end
      end
    end

    def blocking_tick
      tick
      @runner.wait_till_done
    end

    def stop!
      @runner.stop!
    end


    def lock
      got_lock = false
      lock_key = Manager.lock_key

      while(!got_lock)
        begin
          if redis.setnx lock_key, Time.now.to_i + 60
            redis.expire lock_key, 60
            got_lock = true
          else
            begin
              redis.watch lock_key
              time = redis.get Manager.lock_key
              if time && time.to_i < Time.now.to_i
                got_lock = redis.multi do
                  redis.set Manager.lock_key, Time.now.to_i + 60
                end
              end
            ensure
              redis.unwatch
            end
          end

        end
      end
      yield
    ensure
      redis.del Manager.lock_key
    end

    def self.lock_key
      "_scheduler_lock_"
    end

    def self.queue_key
      "_scheduler_queue_"
    end

    def self.schedule_key(klass)
      "_scheduler_#{klass}"
    end
  end
end
