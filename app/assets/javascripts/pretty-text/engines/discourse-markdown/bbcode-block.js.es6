let isWhiteSpace;

function trailingSpaceOnly(src, start, max) {
  let i;
  for(i=start;i<max;i++) {
    let code = src.charCodeAt(i);
    if (code === 0x0A) { return true; }
    if (!isWhiteSpace(code)) { return false; }
  }

  return true;
}

const ATTR_REGEX = /(([a-z0-9]*)\s*=)/ig;

// parse a tag [test a=1 b=2] to a data structure
// {tag: "test", attrs={a: "1", b: "2"}
export function parseBBCodeTag(src, start, max, multiline) {

  let i;
  let tag;
  let attrs = {};
  let closed = false;
  let length = 0;
  let closingTag = false;

  // closing tag
  if (src.charCodeAt(start+1) === 47) {
    closingTag = true;
    start += 1;
  }

  for (i=start+1;i<max;i++) {
    let letter = src[i];
    if (!( (letter >= 'a' && letter <= 'z') ||
         (letter >= 'A' && letter <= 'Z'))) {
      break;
    }
  }

  tag = src.slice(start+1, i);

  if (!tag) {
    return;
  }

  if (closingTag) {
    if (src[i] === ']') {

      if (multiline && !trailingSpaceOnly(src, i+1, max)) {
        return;
      }

      return {tag, length: tag.length+3, closing: true};
    }
    return;
  }

  for (;i<max;i++) {
    let letter = src[i];

    if (letter === ']') {
      closed = true;
      break;
    }
  }

  if (closed) {
    length = (i-start)+1;

    let raw = src.slice(start+tag.length+1, i);

    // trivial parser that is going to have to be rewritten at some point
    if (raw) {

      let match, key, val;

      while(match = ATTR_REGEX.exec(raw)) {
        if (key) {
          val = raw.slice(attrs[key],match.index) || '';
          val = val.trim();
          val = val.replace(/^["'](.*)["']$/, '$1');
          attrs[key] = val;
        }
        key = match[2] || '_default';
        attrs[key] = match.index + match[0].length;
      }

      if (key) {
        val = raw.slice(attrs[key]);
        val = val.replace(/^["'](.*)["']$/, '$1');
        attrs[key] = val;
      }
    }

    if (multiline && !trailingSpaceOnly(src, start+length, max)) {
      return;
    }

    tag = tag.toLowerCase();

    return {tag, attrs, length};
  }
}

function applyBBCode(state, startLine, endLine, silent, md) {

  var nextLine,
      old_parent, old_line_max, rule,
      start = state.bMarks[startLine] + state.tShift[startLine],
      initial = start,
      max = state.eMarks[startLine];

  // [ === 91
  if (91 !== state.src.charCodeAt(start)) { return false; }

  let info = parseBBCodeTag(state.src, start, max, true);

  if (!info || info.closing) {
    return false;
  }

  let ruleInfo = md.block.bbcode.ruler.getRuleForTag(info.tag);
  if (!ruleInfo) { return false; }

  rule = ruleInfo.rule;

  // Since start is found, we can report success here in validation mode
  if (silent) { return true; }

  // Search for the end of the block
  nextLine = startLine;

  let closeTag;
  let nesting = 0;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed bbcode block should not be autoclosed by end of document.
      return false;
    }

    start = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (start < max && state.sCount[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break;
    }


    // bbcode close [ === 91
    if (91 !== state.src.charCodeAt(start)) { continue; }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue;
    }

    closeTag = parseBBCodeTag(state.src, start, max, true);

    if (closeTag && closeTag.closing && closeTag.tag === info.tag) {
      if (nesting === 0) {
        break;
      }
      nesting--;
    }

    if (closeTag && !closeTag.closing && closeTag.tag === info.tag) {
      nesting++;
    }

    closeTag = null;
  }

  if (!closeTag) {
    return false;
  }

  old_parent = state.parentType;
  old_line_max = state.lineMax;

  // this will prevent lazy continuations from ever going past our end marker
  state.lineMax = nextLine;

  if (rule.replace) {
    let content = state.src.slice(state.bMarks[startLine+1], state.eMarks[nextLine-1]);
    if (!rule.replace.call(this, state, info, content)) {
      return false;
    }
  } else {

    if (rule.before) {
      rule.before.call(this, state, info.attrs, md, state.src.slice(initial, initial + info.length + 1));
    }

    let wrapTag;
    if (rule.wrap) {
      let token;

      if (typeof rule.wrap === 'function') {
        token = new state.Token('wrap_bbcode', 'div', 1);
        token.level = state.level+1;

        if (!rule.wrap(token, info)) {
          return false;
        }

        state.tokens.push(token);
        state.level = token.level;
        wrapTag = token.tag;

      } else {

        let split = rule.wrap.split('.');
        wrapTag = split[0];
        let className = split.slice(1).join(' ');

        token = state.push('wrap_bbcode', wrapTag, 1);

        if (className) {
          token.attrs = [['class', className]];
        }
      }
    }

    let lastToken = state.tokens[state.tokens.length-1];
    lastToken.map    = [ startLine, nextLine ];

    state.md.block.tokenize(state, startLine + 1, nextLine);

    if (rule.wrap) {
      state.push('wrap_bbcode', wrapTag, -1);
    }

    if (rule.after) {
      rule.after.call(this, state, lastToken, md, state.src.slice(start-2, start + closeTag.length - 1));
    }
  }

  state.parentType = old_parent;
  state.lineMax = old_line_max;
  state.line = nextLine+1;

  return true;
}

export function setup(helper) {
  helper.registerPlugin(md => {
    const ruler = md.block.bbcode.ruler;

    ruler.push('code', {
      tag: 'code',
      replace: function(state, tagInfo, content) {
        let token;
        token = state.push('fence', 'code', 0);
        token.content = content;
        return true;
      }
    });

    isWhiteSpace = md.utils.isWhiteSpace;
    md.block.ruler.after('fence', 'bbcode', (state, startLine, endLine, silent)=> {
      return applyBBCode(state, startLine, endLine, silent, md);
    }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  });
}
