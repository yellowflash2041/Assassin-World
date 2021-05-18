function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}

function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}

function findAllMatches(text, matchers) {
  const matches = [];

  const maxMatches = 100;
  let count = 0;

  matchers.forEach((matcher) => {
    let match;
    while (
      (match = matcher.pattern.exec(text)) !== null &&
      count++ < maxMatches
    ) {
      matches.push({
        index: match.index,
        text: match[0],
        replacement: matcher.replacement,
      });
    }
  });

  return matches.sort((a, b) => a.index - b.index);
}

export function setup(helper) {
  helper.registerPlugin((md) => {
    const replacements = md.options.discourse.watchedWordsReplacements;
    if (!replacements) {
      return;
    }

    const matchers = Object.keys(replacements).map((word) => ({
      pattern: new RegExp(word, "gi"),
      replacement: replacements[word],
    }));

    const cache = {};

    md.core.ruler.push("watched-words-replace", (state) => {
      for (let j = 0, l = state.tokens.length; j < l; j++) {
        if (state.tokens[j].type !== "inline") {
          continue;
        }

        let tokens = state.tokens[j].children;

        let htmlLinkLevel = 0;

        // We scan from the end, to keep position when new tags added.
        // Use reversed logic in links start/end match
        for (let i = tokens.length - 1; i >= 0; i--) {
          const currentToken = tokens[i];

          // Skip content of markdown links
          if (currentToken.type === "link_close") {
            i--;
            while (
              tokens[i].level !== currentToken.level &&
              tokens[i].type !== "link_open"
            ) {
              i--;
            }
            continue;
          }

          // Skip content of html tag links
          if (currentToken.type === "html_inline") {
            if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
              htmlLinkLevel--;
            }

            if (isLinkClose(currentToken.content)) {
              htmlLinkLevel++;
            }
          }

          if (htmlLinkLevel > 0) {
            continue;
          }

          if (currentToken.type === "text") {
            const text = currentToken.content;
            const matches = (cache[text] =
              cache[text] || findAllMatches(text, matchers));

            // Now split string to nodes
            const nodes = [];
            let level = currentToken.level;
            let lastPos = 0;

            let token;
            for (let ln = 0; ln < matches.length; ln++) {
              if (matches[ln].index < lastPos) {
                continue;
              }

              if (matches[ln].index > lastPos) {
                token = new state.Token("text", "", 0);
                token.content = text.slice(lastPos, matches[ln].index);
                token.level = level;
                nodes.push(token);
              }

              let url = state.md.normalizeLink(matches[ln].replacement);
              if (state.md.validateLink(url) && /^https?/.test(url)) {
                token = new state.Token("link_open", "a", 1);
                token.attrs = [["href", url]];
                token.level = level++;
                token.markup = "linkify";
                token.info = "auto";
                nodes.push(token);

                token = new state.Token("text", "", 0);
                token.content = matches[ln].text;
                token.level = level;
                nodes.push(token);

                token = new state.Token("link_close", "a", -1);
                token.level = --level;
                token.markup = "linkify";
                token.info = "auto";
                nodes.push(token);
              } else {
                token = new state.Token("text", "", 0);
                token.content = matches[ln].replacement;
                token.level = level;
                nodes.push(token);
              }

              lastPos = matches[ln].index + matches[ln].text.length;
            }

            if (lastPos < text.length) {
              token = new state.Token("text", "", 0);
              token.content = text.slice(lastPos);
              token.level = level;
              nodes.push(token);
            }

            // replace current node
            state.tokens[j].children = tokens = md.utils.arrayReplaceAt(
              tokens,
              i,
              nodes
            );
          }
        }
      }
    });
  });
}
