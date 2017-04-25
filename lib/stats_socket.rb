require 'socket_server'

class StatsSocket < SocketServer

  def initialize(socket_path)
    super(socket_path)
  end

  protected

  def get_response(command)
    result =
      case command
      when "gc_stat"
        GC.stat.to_json
      else
        "[\"UNKNOWN COMMAND\"]"
      end

    result << "\n"
  end

end
