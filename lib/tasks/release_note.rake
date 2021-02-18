# frozen_string_literal: true

desc "generate a release note from the important commits"
task "release_note:generate", :from, :to do |t, args|
  from = args[:from] || `git describe --tags --abbrev=0`.strip
  to = args[:to] || "HEAD"

  bug_fixes = Set.new
  new_features = Set.new
  ux_changes = Set.new
  sec_changes = Set.new
  perf_changes = Set.new
  a11y_changes = Set.new

  `git log --pretty="tformat:%s" #{from}..#{to}`.each_line do |comment|
    next if comment =~ /^\s*Revert/
    split_comments(comment).each do |line|
      if line =~ /^FIX:/
        bug_fixes << better(line)
      elsif line =~ /^FEATURE:/
        new_features << better(line)
      elsif line =~ /^UX:/
        ux_changes << better(line)
      elsif line =~ /^SECURITY:/
        sec_changes << better(line)
      elsif line =~ /^PERF:/
        perf_changes << better(line)
      elsif line =~ /^A11Y:/
        a11y_changes << better(line)
      end
    end
  end

  print_changes("NEW FEATURES", new_features)
  print_changes("BUG FIXES", bug_fixes)
  print_changes("UX CHANGES", ux_changes)
  print_changes("SECURITY CHANGES", sec_changes)
  print_changes("PERFORMANCE", perf_changes)
  print_changes("ACCESSIBILITY", a11y_changes)
end

def print_changes(heading, changes)
  return if changes.length == 0

  puts heading
  puts "-" * heading.length, ""
  puts changes.to_a, ""
end

def better(line)
  line = remove_prefix(line)
  line = escape_brackets(line)
  line = remove_pull_request(line)
  line[0] = '\#' if line[0] == '#'
  if line[0]
    line[0] = line[0].capitalize
    "- " + line
  else
    nil
  end
end

def remove_prefix(line)
  line.gsub(/^(FIX|FEATURE|UX|SECURITY|PERF|A11Y):/, "").strip
end

def escape_brackets(line)
  line.gsub("<", "`<")
    .gsub(">", ">`")
    .gsub("[", "`[")
    .gsub("]", "]`")
end

def remove_pull_request(line)
  line.gsub(/ \(\#\d+\)$/, "")
end

def split_comments(text)
  text = normalize_terms(text)
  terms = ["FIX:", "FEATURE:", "UX:", "SECURITY:" , "PERF:" , "A11Y:"]
  terms.each do |term|
    text = text.gsub(/(#{term})+/i, term)
    text = newlines_at_term(text, term)
  end
  text.split("\n")
end

def normalize_terms(text)
  text = text.gsub(/(BUGFIX|FIX|BUG):/i, "FIX:")
  text = text.gsub(/FEATURE:/i, "FEATURE:")
  text = text.gsub(/(UX|UI):/i, "UX:")
  text = text.gsub(/(SECURITY):/i, "SECURITY:")
  text = text.gsub(/(PERF):/i, "PERF:")
  text = text.gsub(/(A11Y):/i, "A11Y:")
end

def newlines_at_term(text, term)
  if text.include?(term)
    text = text.split(term).map { |l| l.strip }.join("\n#{term} ")
  end
  text
end
