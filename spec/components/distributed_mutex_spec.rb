require 'rails_helper'
require_dependency 'distributed_mutex'

describe DistributedMutex do
  let(:key) { "test_mutex_key" }

  after do
    $redis.del(key)
  end

  it "allows only one mutex object to have the lock at a time" do
    mutexes = (1..10).map do
      DistributedMutex.new(key)
    end

    x = 0
    mutexes.map do |m|
      Thread.new do
        m.synchronize do
          y = x
          sleep 0.001
          x = y + 1
        end
      end
    end.map(&:join)

    expect(x).to eq(10)
  end

  it "handles auto cleanup correctly" do
    m = DistributedMutex.new(key)

    $redis.setnx key, Time.now.to_i - 1

    start = Time.now.to_i
    m.synchronize do
      "nop"
    end

    # no longer than a second
    expect(Time.now.to_i).to be <= start + 1
  end

  it 'allows the validity of the lock to be configured' do
    freeze_time

    mutex = DistributedMutex.new(key, validity: 2)

    mutex.synchronize do
      expect($redis.ttl(key)).to eq(2)
      expect($redis.get(key).to_i).to eq(Time.now.to_i + 2)
    end

    mutex = DistributedMutex.new(key)

    mutex.synchronize do
      expect($redis.ttl(key)).to eq(DistributedMutex::DEFAULT_VALIDITY)

      expect($redis.get(key).to_i)
        .to eq(Time.now.to_i + DistributedMutex::DEFAULT_VALIDITY)
    end
  end

  it "maintains mutex semantics" do
    m = DistributedMutex.new(key)

    expect {
      m.synchronize do
        m.synchronize {}
      end
    }.to raise_error(ThreadError)
  end

  context "readonly redis" do
    before do
      $redis.slaveof "127.0.0.1", "99991"
    end

    after do
      $redis.slaveof "no", "one"
    end

    it "works even if redis is in readonly" do
      m = DistributedMutex.new(key)
      start = Time.now
      done = false

      expect {
        m.synchronize do
          done = true
        end
      }.to raise_error(Discourse::ReadOnly)

      expect(done).to eq(false)
      expect(Time.now - start).to be < (1.second)
    end
  end

end
