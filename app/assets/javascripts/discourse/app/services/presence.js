import Service from "@ember/service";
import EmberObject, { computed, defineProperty } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import { cancel, debounce, later, throttle } from "@ember/runloop";
import Session from "discourse/models/session";
import { Promise } from "rsvp";
import { isTesting } from "discourse-common/config/environment";
import User from "discourse/models/user";

const PRESENCE_INTERVAL_S = 30;
const PRESENCE_DEBOUNCE_MS = isTesting() ? 0 : 500;
const PRESENCE_THROTTLE_MS = isTesting() ? 0 : 5000;

function createPromiseProxy() {
  const promiseProxy = {};
  promiseProxy.promise = new Promise((resolve, reject) => {
    promiseProxy.resolve = resolve;
    promiseProxy.reject = reject;
  });
  return promiseProxy;
}

export class PresenceChannelNotFound extends Error {}

// Instances of this class are handed out to consumers. They act as
// convenient proxies to the PresenceService and PresenceServiceState
class PresenceChannel extends EmberObject {
  init({ name, presenceService }) {
    super.init(...arguments);
    this.name = name;
    this.presenceService = presenceService;
    defineProperty(
      this,
      "_presenceState",
      readOnly(`presenceService._presenceChannelStates.${name}`)
    );

    this.set("present", false);
    this.set("subscribed", false);
  }

  // Mark the current user as 'present' in this channel
  async enter() {
    await this.presenceService._enter(this);
    this.set("present", true);
  }

  // Mark the current user as leaving this channel
  async leave() {
    await this.presenceService._leave(this);
    this.set("present", false);
  }

  async subscribe(initialData = null) {
    if (this.subscribed) {
      return;
    }
    await this.presenceService._subscribe(this, initialData);
    this.set("subscribed", true);
  }

  async unsubscribe() {
    if (!this.subscribed) {
      return;
    }
    await this.presenceService._unsubscribe(this);
    this.set("subscribed", false);
  }

  @computed("_presenceState.users", "subscribed")
  get users() {
    if (!this.subscribed) {
      return;
    }
    return this._presenceState.users;
  }

  @computed("_presenceState.count", "subscribed")
  get count() {
    if (!this.subscribed) {
      return;
    }
    return this._presenceState.count;
  }

  @computed("_presenceState.count", "subscribed")
  get countOnly() {
    if (!this.subscribed) {
      return;
    }
    return this._presenceState.countOnly;
  }
}

class PresenceChannelState extends EmberObject {
  init({ name, presenceService }) {
    super.init(...arguments);
    this.name = name;
    this.set("users", null);
    this.set("count", null);
    this.set("countOnly", null);
    this.presenceService = presenceService;
  }

  // Is this PresenceChannel object currently subscribed to updates
  // from the server.
  @computed("_subscribedCallback")
  get subscribed() {
    return !!this._subscribedCallback;
  }

  // Subscribe to server-side updates about the channel
  // Ideally, pass an initialData object with serialized PresenceChannel::State
  // data from the server (serialized via PresenceChannelStateSerializer).
  //
  // If initialData is not supplied, an AJAX request will be made for the information.
  async subscribe(initialData = null) {
    if (this.subscribed) {
      return;
    }

    if (!initialData) {
      try {
        initialData = await ajax("/presence/get", {
          data: {
            channel: this.name,
          },
        });
      } catch (e) {
        if (e.jqXHR?.status === 404) {
          throw new PresenceChannelNotFound(
            `PresenceChannel '${this.name}' not found`
          );
        } else {
          throw e;
        }
      }
    }

    this.set("count", initialData.count);
    if (initialData.users) {
      this.set("users", initialData.users);
      this.set("countOnly", false);
    } else {
      this.set("users", null);
      this.set("countOnly", true);
    }

    this.lastSeenId = initialData.last_message_id;

    let callback = (data, global_id, message_id) => {
      this._processMessage(data, global_id, message_id);
    };
    this.presenceService.messageBus.subscribe(
      `/presence${this.name}`,
      callback,
      this.lastSeenId
    );

    this.set("_subscribedCallback", callback);
  }

  // Stop subscribing to updates from the server about this channel
  unsubscribe() {
    if (this.subscribed) {
      this.presenceService.messageBus.unsubscribe(
        `/presence${this.name}`,
        this._subscribedCallback
      );
      this.set("_subscribedCallback", null);
      this.set("users", null);
      this.set("count", null);
    }
  }

  async _resubscribe() {
    this.unsubscribe();
    // Stored at object level for tests to hook in
    this._resubscribePromise = this.subscribe();
    await this._resubscribePromise;
    delete this._resubscribePromise;
  }

  async _processMessage(data, global_id, message_id) {
    if (message_id !== this.lastSeenId + 1) {
      // eslint-disable-next-line no-console
      console.log(
        `PresenceChannel '${
          this.name
        }' dropped message (received ${message_id}, expecting ${
          this.lastSeenId + 1
        }), resyncing...`
      );

      await this._resubscribe();
      return;
    } else {
      this.lastSeenId = message_id;
    }

    if (this.countOnly && data.count_delta !== undefined) {
      this.set("count", this.count + data.count_delta);
    } else if (
      !this.countOnly &&
      (data.entering_users || data.leaving_user_ids)
    ) {
      if (data.entering_users) {
        const users = data.entering_users.map((u) => User.create(u));
        this.users.addObjects(users);
      }
      if (data.leaving_user_ids) {
        const leavingIds = new Set(data.leaving_user_ids);
        const toRemove = this.users.filter((u) => leavingIds.has(u.id));
        this.users.removeObjects(toRemove);
      }
      this.set("count", this.users.length);
    } else {
      // Unexpected message
      await this._resubscribe();
      return;
    }
  }
}

export default class PresenceService extends Service {
  init() {
    super.init(...arguments);
    this._presentChannels = new Set();
    this._queuedEvents = [];
    this._presenceChannelStates = EmberObject.create();
    this._presentProxies = {};
    this._subscribedProxies = {};
    window.addEventListener("beforeunload", () => {
      this._beaconLeaveAll();
    });
  }

  // Get a PresenceChannel object representing a single channel
  getChannel(channelName) {
    return PresenceChannel.create({
      name: channelName,
      presenceService: this,
    });
  }

  _addPresent(channelProxy) {
    let present = this._presentProxies[channelProxy.name];
    if (!present) {
      present = this._presentProxies[channelProxy.name] = new Set();
    }
    present.add(channelProxy);
    return present.size;
  }

  _removePresent(channelProxy) {
    let present = this._presentProxies[channelProxy.name];
    present?.delete(channelProxy);
    return present?.size || 0;
  }

  _addSubscribed(channelProxy) {
    let subscribed = this._subscribedProxies[channelProxy.name];
    if (!subscribed) {
      subscribed = this._subscribedProxies[channelProxy.name] = new Set();
    }
    subscribed.add(channelProxy);
    return subscribed.size;
  }

  _removeSubscribed(channelProxy) {
    let subscribed = this._subscribedProxies[channelProxy.name];
    subscribed?.delete(channelProxy);
    return subscribed?.size || 0;
  }

  async _enter(channelProxy) {
    if (!this.currentUser) {
      throw "Must be logged in to enter presence channel";
    }

    this._addPresent(channelProxy);

    const channelName = channelProxy.name;
    if (this._presentChannels.has(channelName)) {
      return;
    }

    const promiseProxy = createPromiseProxy();

    this._presentChannels.add(channelName);
    this._queuedEvents.push({
      channel: channelName,
      type: "enter",
      promiseProxy: promiseProxy,
    });

    this._scheduleNextUpdate();

    await promiseProxy.promise;
  }

  async _leave(channelProxy) {
    if (!this.currentUser) {
      throw "Must be logged in to leave presence channel";
    }

    const presentCount = this._removePresent(channelProxy);
    if (presentCount > 0) {
      return;
    }

    const channelName = channelProxy.name;
    if (!this._presentChannels.has(channelName)) {
      return;
    }

    const promiseProxy = createPromiseProxy();

    this._presentChannels.delete(channelName);
    this._queuedEvents.push({
      channel: channelName,
      type: "leave",
      promiseProxy: promiseProxy,
    });

    this._scheduleNextUpdate();

    await promiseProxy.promise;
  }

  async _subscribe(channelProxy, initialData = null) {
    this._addSubscribed(channelProxy);
    const channelName = channelProxy.name;
    let state = this._presenceChannelStates[channelName];
    if (!state) {
      state = PresenceChannelState.create({
        name: channelName,
        presenceService: this,
      });
      this._presenceChannelStates.set(channelName, state);
      await state.subscribe(initialData);
    }
  }

  _unsubscribe(channelProxy) {
    const subscribedCount = this._removeSubscribed(channelProxy);
    if (subscribedCount === 0) {
      const channelName = channelProxy.name;
      this._presenceChannelStates[channelName].unsubscribe();
      this._presenceChannelStates.set(channelName, undefined);
    }
  }

  _beaconLeaveAll() {
    if (isTesting()) {
      return;
    }
    this._dedupQueue();
    const channelsToLeave = this._queuedEvents
      .filter((e) => e.type === "leave")
      .map((e) => e.channel);

    const data = new FormData();
    data.append("client_id", this.messageBus.clientId);
    this._presentChannels.forEach((ch) => data.append("leave_channels[]", ch));
    channelsToLeave.forEach((ch) => data.append("leave_channels[]", ch));

    data.append("authenticity_token", Session.currentProp("csrfToken"));
    navigator.sendBeacon("/presence/update", data);
  }

  _dedupQueue() {
    const deduplicated = {};
    this._queuedEvents.forEach((e) => {
      if (deduplicated[e.channel]) {
        deduplicated[e.channel].promiseProxy.resolve(e.promiseProxy.promise);
      }
      deduplicated[e.channel] = e;
    });
    this._queuedEvents = Object.values(deduplicated);
  }

  async _updateServer() {
    this._lastUpdate = new Date();
    this._updateRunning = true;

    this._cancelTimer();

    this._dedupQueue();
    const queue = this._queuedEvents;
    this._queuedEvents = [];

    try {
      const channelsToLeave = queue
        .filter((e) => e.type === "leave")
        .map((e) => e.channel);

      const response = await ajax("/presence/update", {
        data: {
          client_id: this.messageBus.clientId,
          present_channels: [...this._presentChannels],
          leave_channels: channelsToLeave,
        },
        type: "POST",
      });

      queue.forEach((e) => {
        if (response[e.channel] === false) {
          e.promiseProxy.reject(
            new PresenceChannelNotFound(
              `PresenceChannel '${e.channel}' not found`
            )
          );
        } else {
          e.promiseProxy.resolve();
        }
      });
    } catch (e) {
      // Updating server failed. Put the failed events
      // back in the queue for next time
      this._queuedEvents.unshift(...queue);
      if (e.jqXHR?.status === 429) {
        // Rate limited. No need to raise, we'll try again later
      } else {
        throw e;
      }
    } finally {
      this._updateRunning = false;
      this._scheduleNextUpdate();
    }
  }

  // `throttle` only allows triggering on the first **or** the last event
  // in a sequence of calls. We want both. We want the first event, to make
  // things very responsive. Then if things are happening too frequently, we
  // drop back to the last event via the regular throttle function.
  _throttledUpdateServer() {
    if (
      !this._lastUpdate ||
      new Date() - this._lastUpdate > PRESENCE_THROTTLE_MS
    ) {
      this._updateServer();
    } else {
      throttle(this, this._updateServer, PRESENCE_THROTTLE_MS, false);
    }
  }

  _cancelTimer() {
    if (this._nextUpdateTimer) {
      cancel(this._nextUpdateTimer);
      this._nextUpdateTimer = null;
    }
  }

  _scheduleNextUpdate() {
    if (this._updateRunning) {
      return;
    } else if (this._queuedEvents.length > 0) {
      this._cancelTimer();
      debounce(this, this._throttledUpdateServer, PRESENCE_DEBOUNCE_MS);
    } else if (!this._nextUpdateTimer && !isTesting()) {
      this._nextUpdateTimer = later(
        this,
        this._throttledUpdateServer,
        PRESENCE_INTERVAL_S * 1000
      );
    }
  }
}
