require "socket"
require "csv"
require "yaml"
require "optparse"

@include_env = false
@result_file = nil
@iterations = 500
@best_of = 1
opts = OptionParser.new do |o|
  o.banner = "Usage: ruby bench.rb [options]"

  o.on("-n", "--with_default_env", "Include recommended Discourse env") do
    @include_env = true
  end
  o.on("-o", "--output [FILE]", "Output results to this file") do |f|
    @result_file = f
  end
  o.on("-i", "--iterations [ITERATIONS]", "Number of iterations to run the bench for") do |i|
    @iterations = i.to_i
  end
  o.on("-b", "--best_of [NUM]", "Number of times to run the bench taking best as result") do |i|
    @best_of = i.to_i
  end
end
opts.parse!

def run(command, opt = nil)
  if opt == :quiet
    system(command, out: "/dev/null", err: :out)
  else
    system(command, out: $stdout, err: :out)
  end
end

begin
  require 'facter'
rescue LoadError
  run "gem install facter"
  puts "please rerun script"
  exit
end

@timings = {}


def measure(name)
  start = Time.now
  yield
  @timings[name] = ((Time.now - start) * 1000).to_i
end

def prereqs
  puts "Be sure to following packages are installed:

sudo tasksel install postgresql-server
sudo apt-get -y install build-essential libssl-dev libyaml-dev git libtool libxslt-dev libxml2-dev libpq-dev gawk curl pngcrush python-software-properties

sudo apt-add-repository -y ppa:rwky/redis
sudo apt-get update
sudo apt-get install redis-server
  "
end

puts "Running bundle"
if !run("bundle", :quiet)
  puts "Quitting, some of the gems did not install"
  prereqs
  exit
end

puts "Ensuring config is setup"

%x{which ab > /dev/null 2>&1}
unless $? == 0
  abort "Apache Bench is not installed. Try: apt-get install apache2-utils or brew install ab"
end


unless File.exists?("config/database.yml")
  puts "Copying database.yml.development.sample to database.yml"
  `cp config/database.yml.development-sample config/database.yml`
end

unless File.exists?("config/redis.yml")
  puts "Copying redis.yml.sample to redis.yml"
  `cp config/redis.yml.sample config/redis.yml`
end

ENV["RAILS_ENV"] = "profile"


if @include_env
  puts "Running with tuned environment"
  ENV["RUBY_GC_MALLOC_LIMIT"] = "50_000_000"
  ENV.delete "RUBY_HEAP_SLOTS_GROWTH_FACTOR"
  ENV.delete "RUBY_HEAP_MIN_SLOTS"
  ENV.delete "RUBY_FREE_MIN"
else
  # clean env
  puts "Running with the following custom environment"
  %w{RUBY_GC_MALLOC_LIMIT RUBY_HEAP_MIN_SLOTS RUBY_FREE_MIN}.each do |w|
    puts "#{w}: #{ENV[w]}"
  end
end

def port_available? port
  server = TCPServer.open("0.0.0.0", port)
  server.close
  true
rescue Errno::EADDRINUSE
  false
end

@port = 60079

while !port_available? @port
  @port += 1
end

puts "Ensuring profiling DB exists and is migrated"
puts `bundle exec rake db:create`
`bundle exec rake db:migrate`

puts "Timing loading Rails"
measure("load_rails") do
  `bundle exec rake middleware`
end

puts "Populating Profile DB"
run("bundle exec ruby script/profile_db_generator.rb")

puts "Getting api key"
api_key = `bundle exec rake api_key:get`.split("\n")[-1]

def bench(path)
  puts "Running apache bench warmup"
  `ab -n 10 "http://127.0.0.1:#{@port}#{path}"`
  puts "Benchmarking #{path}"
  `ab -n #{@iterations} -e tmp/ab.csv "http://127.0.0.1:#{@port}#{path}"`

  percentiles = Hash[*[50, 75, 90, 99].zip([]).flatten]
  CSV.foreach("tmp/ab.csv") do |percent, time|
    percentiles[percent.to_i] = time.to_i if percentiles.key? percent.to_i
  end

  percentiles
end

begin
  # critical cause cache may be incompatible
  puts "precompiling assets"
  run("bundle exec rake assets:precompile")

  pid = spawn("bundle exec thin start -p #{@port}")

  while port_available? @port
    sleep 1
  end

  puts "Starting benchmark..."
  append = "?api_key=#{api_key}&api_username=admin1"

  # asset precompilation is a dog, wget to force it
  run "wget http://127.0.0.1:#{@port}/ -o /dev/null"

  tests = [
    ["home", "/"],
    ["topic", "/t/oh-how-i-wish-i-could-shut-up-like-a-tunnel-for-so/69"],
    # ["user", "/users/admin1/activity"],
    ["categories", "/categories"]
  ]

  tests += tests.map{|k,url| ["#{k}_admin", "#{url}#{append}"]}
  tests.shuffle

  def best_of(a, b)
    return a unless b
    return b unless a

    a[50] < b[50] ? a : b
  end


  results = {}
  @best_of.times do
    tests.each do |name, url|
      results[name] = best_of(bench(url),results[name])
    end
  end


  puts "Your Results: (note for timings- percentile is first, duration is second in millisecs)"

  facts = Facter.to_hash

  facts.delete_if{|k,v|
    !["operatingsystem","architecture","kernelversion",
    "memorysize", "physicalprocessorcount", "processor0",
    "virtual"].include?(k)
  }

  run("RAILS_ENV=profile bundle exec rake assets:clean")

  rss = `ps -o rss -p #{pid}`.chomp.split("\n").last.to_i

  results.merge({
    "timings" => @timings,
    "ruby-version" => "#{RUBY_VERSION}-p#{RUBY_PATCHLEVEL}",
    "rss_kb" => rss
  }).merge(facts)

  puts results.to_yaml

  if @result_file
    File.open(@result_file,"wb") do |f|
      f.write(results)
    end
  end


  # TODO include Facter.to_hash ... for all facts
ensure
  Process.kill "KILL", pid
end
