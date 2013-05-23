class SqlBuilder

  def initialize(template,klass=nil)
    @args = {}
    @sql = template
    @sections = {}
    @klass = klass
  end

  [:set, :where2,:where,:order_by,:limit,:left_join,:join,:offset, :select].each do |k|
    define_method k do |data, args = {}|
      @args.merge!(args)
      @sections[k] ||= []
      @sections[k] << data
      self
    end
  end

  def to_sql
    sql = @sql.dup

    @sections.each do |k,v|
      joined = nil
      case k
      when :select
        joined = "SELECT " << v.join(" , ")
      when :where, :where2
        joined = "WHERE " << v.map{|c| "(" << c << ")" }.join(" AND ")
      when :join
        joined = v.map{|v| "JOIN " << v }.join("\n")
      when :left_join
        joined = v.map{|v| "LEFT JOIN " << v }.join("\n")
      when :limit
        joined = "LIMIT " << v.last.to_s
      when :offset
        joined = "OFFSET " << v.last.to_s
      when :order_by
        joined = "ORDER BY " << v.join(" , ")
      when :set
        joined = "SET " << v.join(" , ")
      end

      sql.sub!("/*#{k}*/", joined)
    end
    sql
  end

  def exec(args = {})
    @args.merge!(args)

    sql = to_sql
    if @klass
      @klass.find_by_sql(ActiveRecord::Base.send(:sanitize_sql_array, [sql, @args]))
    else
      ActiveRecord::Base.exec_sql(sql,@args)
    end
  end

  #weird AS reloading
  unless defined? FTYPE_MAP
    FTYPE_MAP = {
      23 => :value_to_integer,
      1114 => :string_to_time
    }
  end

  def map_exec(klass, args = {})
    results = exec(args)

    setters = results.fields.each_with_index.map do |f, index|
      [(f.dup << "=").to_sym, FTYPE_MAP[results.ftype(index)]]
    end
    values = results.values
    values.map! do |row|
      mapped = klass.new
      setters.each_with_index do |mapper, index|
        translated = row[index]
        if mapper[1] && !translated.nil?
          translated = ActiveRecord::ConnectionAdapters::Column.send mapper[1], translated
        end
        mapped.send mapper[0], translated
      end
      mapped
    end
  end

end

class ActiveRecord::Base
  def self.sql_builder(template)
    SqlBuilder.new(template, self)
  end
end
