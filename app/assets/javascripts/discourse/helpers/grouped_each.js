var DiscourseGroupedEach = function(context, path, options) {
  var self = this,
      normalized = Ember.Handlebars.normalizePath(context, path, options.data);

  this.context = context;
  this.path = path;
  this.options = options;
  this.template = options.fn;
  this.containingView = options.data.view;
  this.normalizedRoot = normalized.root;
  this.normalizedPath = normalized.path;
  this.content = this.lookupContent();

  this.addContentObservers();
  this.addArrayObservers();

  this.containingView.on('willClearRender', function() {
    self.destroy();
  });
};

DiscourseGroupedEach.prototype = {
  contentWillChange: function() {
    this.removeArrayObservers();
  },

  contentDidChange: function() {
    this.content = this.lookupContent();
    this.addArrayObservers();
    this.rerenderContainingView();
  },

  contentArrayWillChange: Ember.K,

  contentArrayDidChange: function() {
    this.rerenderContainingView();
  },

  lookupContent: function() {
    return Ember.Handlebars.get(this.normalizedRoot, this.normalizedPath, this.options);
  },

  addArrayObservers: function() {
    this.content.addArrayObserver(this, {
      willChange: 'contentArrayWillChange',
      didChange: 'contentArrayDidChange'
    });
  },

  removeArrayObservers: function() {
    this.content.removeArrayObserver(this, {
      willChange: 'contentArrayWillChange',
      didChange: 'contentArrayDidChange'
    });
  },

  addContentObservers: function() {
    Ember.addBeforeObserver(this.normalizedRoot, this.normalizedPath, this, this.contentWillChange);
    Ember.addObserver(this.normalizedRoot, this.normalizedPath, this, this.contentDidChange);
  },

  removeContentObservers: function() {
    Ember.removeBeforeObserver(this.normalizedRoot, this.normalizedPath, this.contentWillChange);
    Ember.removeObserver(this.normalizedRoot, this.normalizedPath, this.contentDidChange);
  },

  render: function() {
    var content = this.content,
        contentLength = Em.get(content, 'length'),
        data = this.options.data,
        template = this.template;

    data.insideEach = true;
    data.insideGroup = true;
    for (var i = 0; i < contentLength; i++) {
      template(content.objectAt(i), { data: data });
    }
  },

  rerenderContainingView: function() {
    Ember.run.scheduleOnce('render', this.containingView, 'rerender');
  },

  destroy: function() {
    this.removeContentObservers();
    this.removeArrayObservers();
  }
};


Ember.Handlebars.registerHelper('groupedEach', function(path, options) {
  if (arguments.length === 4) {
    Ember.assert("If you pass more than one argument to the groupedEach helper, it must be in the form #groupedEach foo in bar", arguments[1] === "in");

    var keywordName = arguments[0];

    options = arguments[3];
    path = arguments[2];
    if (path === '') { path = "this"; }

    options.hash.keyword = keywordName;
  }

  if (arguments.length === 1) {
    options = path;
    path = 'this';
  }

  options.hash.dataSourceBinding = path;
  new DiscourseGroupedEach(this, path, options).render();
});