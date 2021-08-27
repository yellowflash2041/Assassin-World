import {
  acceptance,
  publishToMessageBus,
} from "discourse/tests/helpers/qunit-helpers";
import { test } from "qunit";
import { PresenceChannelNotFound } from "discourse/services/presence";

function usersFixture() {
  return [
    {
      id: 1,
      username: "bruce0",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/90ced4/{size}.png",
    },
    {
      id: 2,
      username: "bruce1",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/9de053/{size}.png",
    },
    {
      id: 3,
      username: "bruce2",
      name: "Bruce Wayne",
      avatar_template: "/letter_avatar_proxy/v4/letter/b/35a633/{size}.png",
    },
  ];
}
acceptance("Presence - Subscribing", function (needs) {
  needs.pretender((server, helper) => {
    server.get("/presence/get", (request) => {
      if (request.queryParams.channel?.startsWith("/test/")) {
        return helper.response({
          count: 3,
          last_message_id: 1,
          users: usersFixture(),
        });
      } else if (request.queryParams.channel?.startsWith("/countonly/")) {
        return helper.response({
          count: 3,
          last_message_id: 1,
        });
      }

      return helper.response(404, {});
    });
  });

  test("subscribing and receiving updates", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/test/ch1");
    assert.equal(channel.name, "/test/ch1");

    await channel.subscribe({
      users: usersFixture(),
      last_message_id: 1,
    });

    assert.equal(channel.users.length, 3, "it starts with three users");

    publishToMessageBus(
      "/presence/test/ch1",
      {
        leaving_user_ids: [1],
      },
      0,
      2
    );

    assert.equal(channel.users.length, 2, "one user is removed");

    publishToMessageBus(
      "/presence/test/ch1",
      {
        entering_users: [usersFixture()[0]],
      },
      0,
      3
    );

    assert.equal(channel.users.length, 3, "one user is added");
  });

  test("fetches data when no initial state", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/test/ch1");

    await channel.subscribe();

    assert.equal(channel.users.length, 3, "loads initial state");

    publishToMessageBus(
      "/presence/test/ch1",
      {
        leaving_user_ids: [1],
      },
      0,
      2
    );

    assert.equal(
      channel.users.length,
      2,
      "updates following messagebus message"
    );

    publishToMessageBus(
      "/presence/test/ch1",
      {
        leaving_user_ids: [2],
      },
      0,
      99
    );

    await channel._presenceState._resubscribePromise;

    assert.equal(
      channel.users.length,
      3,
      "detects missed messagebus message, fetches data from server"
    );
  });

  test("raises error when subscribing to nonexistent channel", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/nonexistent/ch1");

    assert.rejects(
      channel.subscribe(),
      PresenceChannelNotFound,
      "raises not found"
    );
  });

  test("can subscribe to count_only channel", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/countonly/ch1");

    await channel.subscribe();

    assert.equal(channel.count, 3, "has the correct count");
    assert.equal(channel.countOnly, true, "identifies as countOnly");
    assert.equal(channel.users, null, "has null users list");

    publishToMessageBus(
      "/presence/countonly/ch1",
      {
        count_delta: 1,
      },
      0,
      2
    );

    assert.equal(channel.count, 4, "updates the count via messagebus");

    publishToMessageBus(
      "/presence/countonly/ch1",
      {
        leaving_user_ids: [2],
      },
      0,
      3
    );

    await channel._presenceState._resubscribePromise;

    assert.equal(
      channel.count,
      3,
      "resubscribes when receiving a non-count-only message"
    );
  });

  test("can share data between multiple PresenceChannel objects", async function (assert) {
    let presenceService = this.container.lookup("service:presence");
    let channel = presenceService.getChannel("/test/ch1");
    let channelDup = presenceService.getChannel("/test/ch1");

    await channel.subscribe();
    assert.equal(channel.subscribed, true, "channel is subscribed");
    assert.equal(channel.count, 3, "channel has the correct count");
    assert.equal(channel.users.length, 3, "channel has users");

    assert.equal(channelDup.subscribed, false, "channelDup is not subscribed");
    assert.equal(channelDup.count, null, "channelDup has no count");
    assert.equal(channelDup.users, null, "channelDup has users");

    await channelDup.subscribe();
    assert.equal(channelDup.subscribed, true, "channelDup can subscribe");
    assert.ok(
      channelDup._presenceState,
      "channelDup has a valid internal state"
    );
    assert.equal(
      channelDup._presenceState,
      channel._presenceState,
      "internal state is shared"
    );

    await channel.unsubscribe();
    assert.equal(channel.subscribed, false, "channel can unsubscribe");
    assert.equal(
      channelDup._presenceState,
      channel._presenceState,
      "state is maintained"
    );

    await channelDup.unsubscribe();
    assert.equal(channel.subscribed, false, "channelDup can unsubscribe");
    assert.equal(channelDup._presenceState, undefined, "state is cleared");
  });
});

acceptance("Presence - Entering and Leaving", function (needs) {
  needs.user();

  const requests = [];
  needs.hooks.afterEach(() => requests.clear());
  needs.pretender((server, helper) => {
    server.post("/presence/update", (request) => {
      const body = new URLSearchParams(request.requestBody);
      requests.push(body);

      const response = {};
      const channelsRequested = body.getAll("present_channels[]");
      channelsRequested.forEach((c) => {
        if (c.startsWith("/test/")) {
          response[c] = true;
        } else {
          response[c] = false;
        }
      });

      return helper.response(response);
    });
  });

  test("can join and leave channels", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("/test/ch1");

    await channel.enter();
    assert.equal(requests.length, 1, "updated the server for enter");
    let presentChannels = requests.pop().getAll("present_channels[]");
    assert.deepEqual(
      presentChannels,
      ["/test/ch1"],
      "included the correct present channel"
    );

    await channel.leave();
    assert.equal(requests.length, 1, "updated the server for leave");
    const request = requests.pop();
    presentChannels = request.getAll("present_channels[]");
    const leaveChannels = request.getAll("leave_channels[]");
    assert.deepEqual(presentChannels, [], "included no present channels");
    assert.deepEqual(
      leaveChannels,
      ["/test/ch1"],
      "included the correct leave channel"
    );
  });

  test("raises an error when entering a non-existant channel", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("/blah/doesnotexist");
    await assert.rejects(
      channel.enter(),
      PresenceChannelNotFound,
      "raises a not found error"
    );
  });

  test("deduplicates calls from multiple PresenceChannel instances", async function (assert) {
    const presenceService = this.container.lookup("service:presence");
    const channel = presenceService.getChannel("/test/ch1");
    const channelDup = presenceService.getChannel("/test/ch1");

    await channel.enter();
    assert.equal(channel.present, true, "channel is present");
    assert.equal(channelDup.present, false, "channelDup is absent");
    assert.ok(
      presenceService._presentChannels.has("/test/ch1"),
      "service shows present"
    );

    await channelDup.enter();
    assert.equal(channel.present, true, "channel is present");
    assert.equal(channelDup.present, true, "channelDup is present");
    assert.ok(
      presenceService._presentChannels.has("/test/ch1"),
      "service shows present"
    );

    await channel.leave();
    assert.equal(channel.present, false, "channel is absent");
    assert.equal(channelDup.present, true, "channelDup is present");
    assert.ok(
      presenceService._presentChannels.has("/test/ch1"),
      "service shows present"
    );

    await channelDup.leave();
    assert.equal(channel.present, false, "channel is absent");
    assert.equal(channel.present, false, "channelDup is absent");
    assert.notOk(
      presenceService._presentChannels.has("/test/ch1"),
      "service shows absent"
    );
  });
});
