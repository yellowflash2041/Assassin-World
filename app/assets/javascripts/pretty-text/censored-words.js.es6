function escapeRegexp(text) {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\*/g, "\S*");
}

export function censorFn(censoredWords, censoredPattern, replacementLetter, watchedWordsRegularExpressions) {

  let patterns = [];

  replacementLetter = replacementLetter || "&#9632;";

  if (censoredWords && censoredWords.length) {
    patterns = censoredWords.split("|");
    if (!watchedWordsRegularExpressions) {
      patterns = patterns.map(t => `(${escapeRegexp(t)})`);
    }
  }

  if (censoredPattern && censoredPattern.length > 0) {
    patterns.push("(" + censoredPattern + ")");
  }

  if (patterns.length) {
    let censorRegexp;

    try {
      if (watchedWordsRegularExpressions) {
        censorRegexp = new RegExp("((?:" + patterns.join("|") + "))(?![^\\(]*\\))", "ig");
      } else {
        censorRegexp = new RegExp("(\\b(?:" + patterns.join("|") + ")\\b)(?![^\\(]*\\))", "ig");
      }

      if (censorRegexp) {

        return function(text) {
          let original = text;

          try {
            let m = censorRegexp.exec(text);

            while (m && m[0]) {
              if (m[0].length > original.length) { return original; } // regex is dangerous
              const replacement = new Array(m[0].length+1).join(replacementLetter);
              if (watchedWordsRegularExpressions) {
                text = text.replace(new RegExp(`(${escapeRegexp(m[0])})(?![^\\(]*\\))`, "ig"), replacement);
              } else {
                text = text.replace(new RegExp(`(\\b${escapeRegexp(m[0])}\\b)(?![^\\(]*\\))`, "ig"), replacement);
              }
              m = censorRegexp.exec(text);
            }

            return text;
          } catch (e) {
            return original;
          }
        };

      }
    } catch(e) {
      // fall through
    }
  }

  return function(t){ return t;};
}

export function censor(text, censoredWords, censoredPattern, replacementLetter) {
  return censorFn(censoredWords, censoredPattern, replacementLetter)(text);
}
