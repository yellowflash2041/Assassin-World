import { CANCELLED_STATUS } from 'discourse/lib/autocomplete';

var cache = {},
    cacheTopicId,
    cacheTime,
    currentTerm;

function performSearch(term, topicId, includeGroups, resultsFn) {
  var cached = cache[term];
  if (cached) {
    resultsFn(cached);
    return true;
  }

  Discourse.ajax('/users/search/users', {
    data: { term: term,
            topic_id: topicId,
            include_groups: includeGroups }
  }).then(function (r) {
    cache[term] = r;
    cacheTime = new Date();

    // If there is a newer search term, return null
    if (term !== currentTerm) { r = CANCELLED_STATUS; }
    resultsFn(r);
  });
  return true;
}
var debouncedSearch = _.debounce(performSearch, 300);

function organizeResults(r, options) {
  if (r === CANCELLED_STATUS) { return r; }

  var exclude = options.exclude || [],
      limit = options.limit || 5,
      users = [],
      groups = [],
      results = [];

  r.users.every(function(u) {
    if (exclude.indexOf(u.username) === -1) {
      users.push(u);
      results.push(u);
    }
    return results.length <= limit;
  });

  r.groups.every(function(g) {
    if (results.length > limit) return false;
    if (exclude.indexOf(g.name) === -1) {
      groups.push(g);
      results.push(g);
    }
    return true;
  });

  results.users = users;
  results.groups = groups;
  return results;
}


export default function userSearch(options) {
  var term = options.term || "",
      includeGroups = !!options.include_groups,
      topicId = options.topicId;

  currentTerm = term;

  return new Ember.RSVP.Promise(function(resolve) {
    // TODO site setting for allowed regex in username
    if (term.match(/[^a-zA-Z0-9_\.]/)) {
      resolve([]);
      return;
    }
    if (((new Date() - cacheTime) > 30000) || (cacheTopicId !== topicId)) {
      cache = {};
    }

    cacheTopicId = topicId;
    var executed = debouncedSearch(term, topicId, includeGroups, function(r) {
      resolve(organizeResults(r, options));
    });

    // TODO: This doesn't cancel all debounced promises, we should figure out
    // a way to handle that.
    if (!executed) {
      resolve(CANCELLED_STATUS);
    }
  });
}
