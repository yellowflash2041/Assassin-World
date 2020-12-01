import {
  moduleForWidget,
  widgetTest,
} from "discourse/tests/helpers/widget-test";
import EmberObject from "@ember/object";
import I18n from "I18n";
import { queryAll } from "discourse/tests/helpers/qunit-helpers";

let requests = 0;

moduleForWidget("discourse-poll", {
  pretend(server) {
    server.put("/polls/vote", () => {
      ++requests;
      return [
        200,
        { "Content-Type": "application/json" },
        {
          poll: {
            name: "poll",
            type: "regular",
            status: "open",
            results: "always",
            options: [
              { id: "1f972d1df351de3ce35a787c89faad29", html: "yes", votes: 1 },
              { id: "d7ebc3a9beea2e680815a1e4f57d6db6", html: "no", votes: 0 },
            ],
            voters: 1,
            chart_type: "bar",
          },
          vote: ["1f972d1df351de3ce35a787c89faad29"],
        },
      ];
    });

    server.put("/polls/vote", () => {
      ++requests;
      return [
        200,
        { "Content-Type": "application/json" },
        {
          poll: {
            name: "poll",
            type: "regular",
            status: "open",
            results: "always",
            options: [
              { id: "1f972d1df351de3ce35a787c89faad29", html: "yes", votes: 1 },
              { id: "d7ebc3a9beea2e680815a1e4f57d6db6", html: "no", votes: 0 },
            ],
            voters: 1,
            chart_type: "bar",
            groups: "foo",
          },
          vote: ["1f972d1df351de3ce35a787c89faad29"],
        },
      ];
    });
  },
});

const template = `{{mount-widget
                    widget="discourse-poll"
                    args=(hash id=id
                               post=post
                               poll=poll
                               vote=vote
                               groupableUserFields=groupableUserFields)}}`;

widgetTest("can vote", {
  template,

  beforeEach() {
    this.setProperties({
      post: EmberObject.create({
        id: 42,
        topic: {
          archived: false,
        },
      }),
      poll: EmberObject.create({
        name: "poll",
        type: "regular",
        status: "open",
        results: "always",
        options: [
          { id: "1f972d1df351de3ce35a787c89faad29", html: "yes", votes: 0 },
          { id: "d7ebc3a9beea2e680815a1e4f57d6db6", html: "no", votes: 0 },
        ],
        voters: 0,
        chart_type: "bar",
      }),
      vote: [],
      groupableUserFields: [],
    });
  },

  async test(assert) {
    requests = 0;

    await click("li[data-poll-option-id='1f972d1df351de3ce35a787c89faad29']");
    assert.equal(requests, 1);
    assert.equal(queryAll(".chosen").length, 1);
    assert.equal(queryAll(".chosen").text(), "100%yes");
    assert.equal(queryAll(".toggle-results").text(), "Show vote");

    await click(".toggle-results");
    assert.equal(
      queryAll("li[data-poll-option-id='1f972d1df351de3ce35a787c89faad29']")
        .length,
      1
    );
    assert.equal(queryAll(".toggle-results").text(), "Show results");
  },
});

widgetTest("cannot vote if not member of the right group", {
  template,

  beforeEach() {
    this.setProperties({
      post: EmberObject.create({
        id: 42,
        topic: {
          archived: false,
        },
      }),
      poll: EmberObject.create({
        name: "poll",
        type: "regular",
        status: "open",
        results: "always",
        options: [
          { id: "1f972d1df351de3ce35a787c89faad29", html: "yes", votes: 0 },
          { id: "d7ebc3a9beea2e680815a1e4f57d6db6", html: "no", votes: 0 },
        ],
        voters: 0,
        chart_type: "bar",
        groups: "foo",
      }),
      vote: [],
      groupableUserFields: [],
    });
  },

  async test(assert) {
    requests = 0;

    await click("li[data-poll-option-id='1f972d1df351de3ce35a787c89faad29']");
    assert.equal(
      queryAll(".poll-container .alert").text(),
      I18n.t("poll.results.groups.title", { groups: "foo" })
    );
    assert.equal(requests, 0);
    assert.equal(queryAll(".chosen").length, 0);
  },
});
