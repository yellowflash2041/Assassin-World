import componentTest from "helpers/component-test";
import DiscourseURL from "discourse/lib/url";

moduleForComponent("tag-drop", {
  integration: true,
  beforeEach: function() {
    this.set("subject", selectKit());
  }
});

componentTest("default", {
  template: "{{tag-drop}}",

  beforeEach() {
    this.site.set("can_create_tag", true);
    this.set("site.top_tags", ["jeff", "neil", "arpit", "régis"]);

    const response = object => {
      return [200, { "Content-Type": "application/json" }, object];
    };

    // prettier-ignore
    server.get("/tags/filter/search", (params) => { //eslint-disable-line
      if (params.queryParams.q === "rég") {
        return response({
          "results": [
            { "id": "régis", "text": "régis", "count": 2, "pm_count": 0 }
          ]
        });
      }else if (params.queryParams.q === "dav") {
        return response({
          "results": [
            { "id": "David", "text": "David", "count": 2, "pm_count": 0 }
          ]
        });
      }
    });
  },

  async test(assert) {
    await this.subject.expand();

    assert.equal(
      this.subject.rowByIndex(1).name(),
      "jeff",
      "it has the correct tag"
    );

    assert.equal(
      this.subject.rowByIndex(2).name(),
      "neil",
      "it has the correct tag"
    );

    await this.subject.fillInFilter("rég");
    assert.equal(
      this.subject.rowByIndex(0).name(),
      "régis",
      "it displays the searched tag"
    );

    await this.subject.fillInFilter("");
    assert.equal(
      this.subject.rowByIndex(1).name(),
      "jeff",
      "it returns top tags for an empty search"
    );

    sandbox.stub(DiscourseURL, "routeTo");
    await this.subject.fillInFilter("dav");
    await this.subject.keyboard("enter");
    assert.ok(
      DiscourseURL.routeTo.calledWith("/tags/david"),
      "it uses lowercase URLs for tags"
    );
  }
});

componentTest("no tags", {
  template: "{{tag-drop}}",

  beforeEach() {
    this.site.set("can_create_tag", true);
    this.set("site.top_tags", undefined);
  },

  async test(assert) {
    await this.subject.expand();

    assert.equal(
      this.subject.rowByIndex(1).name(),
      undefined,
      "it has no tags and doesn’t crash"
    );
  }
});
