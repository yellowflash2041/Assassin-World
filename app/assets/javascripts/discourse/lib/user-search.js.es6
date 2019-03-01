import { CANCELLED_STATUS } from "discourse/lib/autocomplete";
import { userPath } from "discourse/lib/url";
import { emailValid } from "discourse/lib/utilities";

var cache = {},
  cacheTopicId,
  cacheTime,
  currentTerm,
  oldSearch;

function performSearch(
  term,
  topicId,
  includeGroups,
  includeMentionableGroups,
  includeMessageableGroups,
  allowedUsers,
  group,
  resultsFn
) {
  var cached = cache[term];
  if (cached) {
    resultsFn(cached);
    return;
  }

  // I am not strongly against unconditionally returning
  // however this allows us to return a list of probable
  // users we want to mention, early on a topic
  if (term === "" && !topicId) {
    return [];
  }

  // need to be able to cancel this
  oldSearch = $.ajax(userPath("search/users"), {
    data: {
      term: term,
      topic_id: topicId,
      include_groups: includeGroups,
      include_mentionable_groups: includeMentionableGroups,
      include_messageable_groups: includeMessageableGroups,
      group: group,
      topic_allowed_users: allowedUsers
    }
  });

  var returnVal = CANCELLED_STATUS;

  oldSearch
    .then(function(r) {
      cache[term] = r;
      cacheTime = new Date();
      // If there is a newer search term, return null
      if (term === currentTerm) {
        returnVal = r;
      }
    })
    .always(function() {
      oldSearch = null;
      resultsFn(returnVal);
    });
}

var debouncedSearch = _.debounce(performSearch, 300);

function organizeResults(r, options) {
  if (r === CANCELLED_STATUS) {
    return r;
  }

  var exclude = options.exclude || [],
    limit = options.limit || 5,
    users = [],
    emails = [],
    groups = [],
    results = [];

  if (r.users) {
    r.users.every(function(u) {
      if (exclude.indexOf(u.username) === -1) {
        users.push(u);
        results.push(u);
      }
      return results.length <= limit;
    });
  }

  if (options.allowEmails && emailValid(options.term)) {
    let e = { username: options.term };
    emails = [e];
    results.push(e);
  }

  if (r.groups) {
    r.groups.every(function(g) {
      if (
        options.term.toLowerCase() === g.name.toLowerCase() ||
        results.length < limit
      ) {
        if (exclude.indexOf(g.name) === -1) {
          groups.push(g);
          results.push(g);
        }
      }
      return true;
    });
  }

  results.users = users;
  results.emails = emails;
  results.groups = groups;
  return results;
}

// all punctuations except for -, _ and . which are allowed in usernames
// note: these are valid in names, but will end up tripping search anyway so just skip
// this means searching for `sam saffron` is OK but if my name is `sam$ saffron` autocomplete
// will not find me, which is a reasonable compromise
//
// we also ignore if we notice a double space or a string that is only a space
const ignoreRegex = /([\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\/:;<=>?\[\]^`{|}~])|\s\s|^\s$/;

function skipSearch(term, allowEmails) {
  if (term.indexOf("@") > -1 && !allowEmails) {
    return true;
  }

  return !!term.match(ignoreRegex);
}

export default function userSearch(options) {
  if (options.term && options.term.length > 0 && options.term[0] === "@") {
    options.term = options.term.substring(1);
  }

  var term = options.term || "",
    includeGroups = options.includeGroups,
    includeMentionableGroups = options.includeMentionableGroups,
    includeMessageableGroups = options.includeMessageableGroups,
    allowedUsers = options.allowedUsers,
    topicId = options.topicId,
    group = options.group;

  if (oldSearch) {
    oldSearch.abort();
    oldSearch = null;
  }

  currentTerm = term;

  return new Ember.RSVP.Promise(function(resolve) {
    if (new Date() - cacheTime > 30000 || cacheTopicId !== topicId) {
      cache = {};
    }

    cacheTopicId = topicId;

    var clearPromise = setTimeout(function() {
      resolve(CANCELLED_STATUS);
    }, 5000);

    if (skipSearch(term, options.allowEmails)) {
      resolve([]);
      return;
    }

    debouncedSearch(
      term,
      topicId,
      includeGroups,
      includeMentionableGroups,
      includeMessageableGroups,
      allowedUsers,
      group,
      function(r) {
        clearTimeout(clearPromise);
        resolve(organizeResults(r, options));
      }
    );
  });
}
