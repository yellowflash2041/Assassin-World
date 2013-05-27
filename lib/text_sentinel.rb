#
# Given a string, tell us whether or not is acceptable.
#
class TextSentinel

  attr_accessor :text

  def initialize(text, opts=nil)
    @opts = opts || {}
    @text = text.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '')
  end

  def self.body_sentinel(text)
    TextSentinel.new(text, min_entropy: SiteSetting.body_min_entropy)
  end

  def self.title_sentinel(text)
    TextSentinel.new(text,
                     min_entropy: SiteSetting.title_min_entropy,
                     max_word_length: SiteSetting.max_word_length)
  end

  # Entropy is a number of how many unique characters the string needs.
  def entropy
    @entropy ||= @text.to_s.strip.split('').uniq.size
  end

  def valid?
    @text.present? &&
    seems_meaningful? &&
    seems_pronounceable? &&
    seems_unpretentious? &&
    seems_quiet? &&
    true
  end

  private

  def symbols_regex
    /[\ -\/\[-\`\:-\@\{-\~]/m
  end

  def seems_meaningful?
    # Minimum entropy if entropy check required
    @opts[:min_entropy].blank? || (entropy >= @opts[:min_entropy])
  end

  def seems_pronounceable?
    # At least some non-symbol characters
    # (We don't have a comprehensive list of symbols, but this will eliminate some noise)
    @text.gsub(symbols_regex, '').size > 0
  end

  def seems_unpretentious?
    # Don't allow super long words if there is a word length maximum
    @opts[:max_word_length].blank? || @text.split(/\s/).map(&:size).max <= @opts[:max_word_length]
  end


  def seems_quiet?
    # We don't allow all upper case content in english
    not((@text =~ /[A-Z]+/) && (@text == @text.upcase))
  end

end
