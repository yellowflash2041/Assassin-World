/**
  Support for various code blocks
**/

var acceptableCodeClasses;

function init() {
  acceptableCodeClasses = Discourse.SiteSettings.highlighted_languages.split("|");
  if (Discourse.SiteSettings.highlighted_languages.length > 0) {
    var regexpSource = "^lang-(" + "nohighlight|auto|" + Discourse.SiteSettings.highlighted_languages + ")$";
    Discourse.Markdown.whiteListTag('code', 'class', new RegExp(regexpSource, "i"));
  }
}

if (Discourse.SiteSettings && Discourse.SiteSettings.highlighted_languages) {
  init();
} else {
  Discourse.initializer({initialize: init, name: 'load-acceptable-code-classes'});
}


var textCodeClasses = ["text", "pre", "plain"];

function flattenBlocks(blocks) {
  var result = "";
  blocks.forEach(function(b) {
    result += b;
    if (b.trailing) { result += b.trailing; }
  });
  return result;
}

Discourse.Dialect.replaceBlock({
  start: /^`{3}([^\n\[\]]+)?\n?([\s\S]*)?/gm,
  stop: /^```$/gm,
  emitter: function(blockContents, matches) {

    var klass = Discourse.SiteSettings.default_code_lang;

    if (matches[1] && acceptableCodeClasses.indexOf(matches[1]) !== -1) {
      klass = matches[1];
    }

    if (textCodeClasses.indexOf(matches[1]) !== -1) {
      return ['p', ['pre', ['code', {'class': 'lang-nohighlight'}, flattenBlocks(blockContents) ]]];
    } else  {
      return ['p', ['pre', ['code', {'class': 'lang-' + klass}, flattenBlocks(blockContents) ]]];
    }
  }
});

Discourse.Dialect.replaceBlock({
  start: /(<pre[^\>]*\>)([\s\S]*)/igm,
  stop: /<\/pre>/igm,
  rawContents: true,
  skipIfTradtionalLinebreaks: true,

  emitter: function(blockContents) {
    return ['p', ['pre', flattenBlocks(blockContents)]];
  }
});

// Ensure that content in a code block is fully escaped. This way it's not white listed
// and we can use HTML and Javascript examples.
Discourse.Dialect.on('parseNode', function (event) {
  var node = event.node,
      path = event.path;

  if (node[0] === 'code') {
    var contents = node[node.length-1],
        regexp;

    if (path && path[path.length-1] && path[path.length-1][0] && path[path.length-1][0] === "pre") {
      regexp = / +$/g;
    } else {
      regexp = /^ +| +$/g;
    }
    node[node.length-1] = Handlebars.Utils.escapeExpression(contents.replace(regexp,''));
  }
});

