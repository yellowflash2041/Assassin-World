var searcherStub;

moduleFor("controller:search", "controller:search", {
  setup: function() {
    Discourse.SiteSettings.min_search_term_length = 2;

    searcherStub = Ember.Deferred.create();
    sandbox.stub(Discourse.Search, "forTerm").returns(searcherStub);
  }
});

test("when no search term is typed yet", function() {
  var controller = this.subject();
  ok(!controller.get("loading"), "loading flag is false");
  ok(!controller.get("noResults"), "noResults flag is false");
  deepEqual(controller.get("content"), [], "content is empty");
  blank(controller.get("selectedIndex"), "selectedIndex is not set");
  blank(controller.get("resultCount"), "result count is not set");
});

test("when user started typing a search term but did not reach the minimum character count threshold yet", function() {
  var controller = this.subject();
  controller.set("term", "a");

  ok(!controller.get("loading"), "loading flag is false");
  ok(!controller.get("noResults"), "noResults flag is false");
  deepEqual(controller.get("content"), [], "content is empty");
  equal(controller.get("selectedIndex"), 0, "selectedIndex is set to 0");
  equal(controller.get("resultCount"), 0, "result count is set to 0");
});

test("when user typed a search term that is equal to or exceeds the minimum character count threshold, but results have not yet finished loading", function() {
  var controller = this.subject();
  controller.set("term", "ab");
  ok(controller.get("loading"), "loading flag is true");
  ok(!controller.get("noResults"), "noResults flag is false");
  deepEqual(controller.get("content"), [], "content is empty");
  equal(controller.get("selectedIndex"), 0, "selectedIndex is set to 0");
  equal(controller.get("resultCount"), 0, "result count is set to 0");
});

test("when user typed a search term that is equal to or exceeds the minimum character count threshold and results have finished loading, but there are no results found", function() {
  var controller = this.subject();
  Em.run(function() {
    searcherStub.resolve([]);
    controller.set("term", "ab");
  });

  ok(!controller.get("loading"), "loading flag is false");
  ok(controller.get("noResults"), "noResults flag is true");
  deepEqual(controller.get("content"), [], "content is empty");
  equal(controller.get("selectedIndex"), 0, "selectedIndex is set to 0");
  equal(controller.get("resultCount"), 0, "result count is set to 0");
});

test("when user typed a search term that is equal to or exceeds the minimum character count threshold and results have finished loading, and there are results found", function() {
  var controller = this.subject();
  Em.run(function() {
    controller.set("term", "ab");
    searcherStub.resolve([{
      type: "user",
      results: [{}]
    }]);
  });

  ok(!controller.get("loading"), "loading flag is false");
  ok(!controller.get("noResults"), "noResults flag is false");
  deepEqual(controller.get("content"), [{
    type: "user",
    results: [{index: 0}]
  }], "content is correctly set");
  equal(controller.get("selectedIndex"), 0, "selectedIndex is set to 0");
  equal(controller.get("resultCount"), 1, "resultCount is correctly set");
});

test("starting to type a new term resets the previous search results", function() {
  var controller = this.subject();
  Em.run.next(function() {
    controller.set("term", "ab");
    searcherStub.resolve([
      {
        type: "user",
        results: [{}]
      }
    ]);
  });

  Ember.run(function() {
    controller.set("term", "x");
  });

  ok(!controller.get("loading"), "loading flag is reset correctly");
  ok(!controller.get("noResults"), "noResults flag is reset correctly");
  deepEqual(controller.get("content"), [], "content is reset correctly");
  equal(controller.get("selectedIndex"), 0, "selected index is reset correctly");
  equal(controller.get("resultCount"), 0, "resultCount is reset correctly");
});

test("search results from the server are correctly reformatted (sections are sorted, section fields are preserved, item sorting is preserved, item fields are preserved, items are globally indexed across all sections)", function() {
  var controller = this.subject();
  Em.run(function() {
    controller.set("term", "ab");
    searcherStub.resolve([
      {
        type: "user",
        results: [
          {itemField: "user-item-1"},
          {itemField: "user-item-2"}
        ],
        sectionField: "user-section"
      },
      {
        type: "topic",
        results: [
          {itemField: "topic-item-1"},
          {itemField: "topic-item-2"}
        ],
        sectionField: "topic-section"
      },
      {
        type: "category",
        results: [
          {itemField: "category-item-1"},
          {itemField: "category-item-2"}
        ],
        sectionField: "category-section"
      }
    ]);
  });

  deepEqual(controller.get("content"), [
    {
      type: "topic",
      results: [
        {index: 0, itemField: "topic-item-1"},
        {index: 1, itemField: "topic-item-2"}
      ],
      sectionField: "topic-section"
    },
    {
      type: "category",
      results: [
        {index: 2, itemField: "category-item-1"},
        {index: 3, itemField: "category-item-2"}
      ],
      sectionField: "category-section"
    },
    {
      type: "user",
      results: [
        {index: 4, itemField: "user-item-1"},
        {index: 5, itemField: "user-item-2"}
      ],
      sectionField: "user-section"
    }
  ]);
});

test("keyboard navigation", function() {
  var controller = this.subject();
  Em.run(function() {
    controller.set("term", "ab");
    searcherStub.resolve([
      {
        type: "user",
        results: [{}, {}, {}]
      }
    ]);
  });

  equal(controller.get("selectedIndex"), 0, "initially the first item is selected");

  controller.moveUp();
  equal(controller.get("selectedIndex"), 0, "you can't move up above the first item");

  controller.moveDown();
  equal(controller.get("selectedIndex"), 1, "you can go down from the first item");

  controller.moveDown();
  equal(controller.get("selectedIndex"), 2, "you can go down from the middle item");

  controller.moveDown();
  equal(controller.get("selectedIndex"), 2, "you can't go down below the last item");

  controller.moveUp();
  equal(controller.get("selectedIndex"), 1, "you can go up from the last item");

  controller.moveUp();
  equal(controller.get("selectedIndex"), 0, "you can go up from the middle item");
});

test("selecting a highlighted item", function() {
  sandbox.stub(Discourse.URL, "routeTo");

  var controller = this.subject();
  Ember.run(function() {
    controller.set("term", "ab");
    searcherStub.resolve([
      {
        type: "user",
        results: [
          {},
          {url: "some-url"}
        ]
      }
    ]);
  });

  Ember.run(function() {
    controller.set("selectedIndex", 0);
  });
  controller.select();
  ok(!Discourse.URL.routeTo.called, "when selected item has no url, there is no redirect");

  Ember.run(function() {
    controller.set("selectedIndex", 1);
  });
  controller.select();
  ok(Discourse.URL.routeTo.calledWith("some-url"), "when selected item has url, a redirect is fired");

  Discourse.URL.routeTo.reset();
  Ember.run(function() {
    controller.set("loading", true);
  });
  controller.select();
  ok(!Discourse.URL.routeTo.called, "when loading flag is set to true, there is no redirect");
});

test("search query / the flow of the search", function() {
  var controller = this.subject();
  Ember.run(function() {
    controller.set("searchContext", "context");
    controller.set("searchContextEnabled", true);
    controller.set("term", "ab");
  });
  ok(Discourse.Search.forTerm.calledWithExactly(
    "ab",
    {
      searchContext: "context",
      typeFilter: null
    }
  ), "when an initial search (with term but without a type filter) is issued, query is built correctly and results are refreshed");
  ok(!controller.get("showCancelFilter"), "when an initial search (with term but without a type filter) is issued, showCancelFilter flag is false");

  Discourse.Search.forTerm.reset();
  Ember.run(function() {
    controller.send("moreOfType", "topic");
  });
  ok(Discourse.Search.forTerm.calledWithExactly(
    "ab",
    {
      searchContext: "context",
      typeFilter: "topic"
    }
  ), "when after the initial search a type filter is applied (moreOfType action is invoked), query is built correctly and results are refreshed");
  ok(!controller.get("showCancelFilter"), "when after the initial search a type filter is applied (moreOfType action is invoked) but the results did not yet finished loading, showCancelFilter flag is still false");
  Ember.run(function() {
    searcherStub.resolve([]);
  });
  ok(controller.get("showCancelFilter"), "when after the initial search a type filter is applied (moreOfType action is invoked) and the results finished loading, showCancelFilter flag is set to true");

  Discourse.Search.forTerm.reset();
  Ember.run(function() {
    controller.send("cancelType");
  });
  ok(Discourse.Search.forTerm.calledWithExactly(
    "ab",
    {
      searchContext: "context",
      typeFilter: null
    }
  ), "when cancelType action is invoked after the results were filtered by type, query is built correctly and results are refreshed");
  ok(!controller.get("showCancelFilter"), "when cancelType action is invoked after the results were filtered by type, showCancelFilter flag is set to false");
});

test("typing new term when the results are filtered by type cancels type filter", function() {
  var controller = this.subject();
  Ember.run(function() {
    controller.set("term", "ab");
    controller.send("moreOfType", "topic");
    searcherStub.resolve([]);
  });

  Discourse.Search.forTerm.reset();
  Ember.run(function() {
    controller.set("term", "xy");
  });
  ok(Discourse.Search.forTerm.calledWith("xy"), "a new search is issued and results are refreshed");
  ok(!controller.get("showCancelFilter"), "showCancelFilter flag is set to false");
});
