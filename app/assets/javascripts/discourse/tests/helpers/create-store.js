import KeyValueStore from "discourse/lib/key-value-store";
import RestAdapter from "discourse/adapters/rest";
import Store from "discourse/services/store";
import TopicListAdapter from "discourse/adapters/topic-list";
import TopicTrackingState from "discourse/models/topic-tracking-state";
import { buildResolver } from "discourse-common/resolver";
import { currentSettings } from "discourse/tests/helpers/site-settings";
import Site from "discourse/models/site";
import RestModel from "discourse/models/rest";

const CatAdapter = RestAdapter.extend({
  primaryKey: "cat_id",
});

const CachedCatAdapter = RestAdapter.extend({
  primaryKey: "cat_id",
  cache: true,
  apiNameFor() {
    return "cat";
  },
});

const CachedCat = RestModel.extend({
  init(...args) {
    // Simulate an implicit injection
    Object.defineProperty(this, "injectedProperty", {
      writable: false,
      enumerable: true,
      value: "hello world",
    });
    this._super(...args);
  },
});

export default function (customLookup = () => {}) {
  const resolver = buildResolver("discourse").create({
    namespace: { modulePrefix: "discourse" },
  });

  // Normally this would happen in inject-discourse-objects.
  // However, `create-store` is used by unit tests which do not init the application.
  Site.current();

  return Store.create({
    register: {
      lookup(type) {
        if (type === "adapter:cat") {
          this._catAdapter =
            this._catAdapter || CatAdapter.create({ owner: this });
          return this._catAdapter;
        }
        if (type === "adapter:cached-cat") {
          this._cachedCatAdapter =
            this._cachedCatAdapter || CachedCatAdapter.create({ owner: this });
          return this._cachedCatAdapter;
        }
        if (type === "adapter:rest") {
          if (!this._restAdapter) {
            this._restAdapter = RestAdapter.create({ owner: this });
          }
          return this._restAdapter;
        }
        if (type === "adapter:topicList") {
          this._topicListAdapter =
            this._topicListAdapter || TopicListAdapter.create({ owner: this });
          return this._topicListAdapter;
        }
        if (type === "service:key-value-store") {
          this._kvs = this._kvs || new KeyValueStore();
          return this._kvs;
        }
        if (type === "service:topic-tracking-state") {
          this._tracker = this._tracker || TopicTrackingState.create();
          return this._tracker;
        }
        if (type === "service:site-settings") {
          this._settings = this._settings || currentSettings();
          return this._settings;
        }
        return customLookup(type);
      },

      lookupFactory(type) {
        const split = type.split(":");
        if (type === "model:cached-cat") {
          return CachedCat;
        }
        return resolver.resolveOther({
          type: split[0],
          fullNameWithoutType: split[1],
          root: {},
        });
      },
    },
  });
}
