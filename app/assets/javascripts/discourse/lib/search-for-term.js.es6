import Topic from 'discourse/models/topic';

function searchForTerm(term, opts) {
  if (!opts) opts = {};

  // Only include the data we have
  var data = { term: term, include_blurbs: 'true' };
  if (opts.typeFilter) data.type_filter = opts.typeFilter;
  if (opts.searchForId) data.search_for_id = true;

  if (opts.searchContext) {
    data.search_context = {
      type: opts.searchContext.type,
      id: opts.searchContext.id
    };
  }

  return Discourse.ajax('/search/query', { data: data }).then(function(results){
    // Topics might not be included
    if (!results.topics) { results.topics = []; }
    if (!results.users) { results.users = []; }
    if (!results.posts) { results.posts = []; }
    if (!results.categories) { results.categories = []; }

    var topicMap = {};
    results.topics = results.topics.map(function(topic){
      topic = Topic.create(topic);
      topicMap[topic.id] = topic;
      return topic;
    });

    results.posts = results.posts.map(function(post){
      post = Discourse.Post.create(post);
      post.set('topic', topicMap[post.topic_id]);
      return post;
    });

    results.users = results.users.map(function(user){
      user = Discourse.User.create(user);
      return user;
    });

    results.categories = results.categories.map(function(category){
      return Discourse.Category.list().findProperty('id', category.id);
    }).compact();

    var r = results.grouped_search_result;
    results.resultTypes = [];

    // TODO: consider refactoring front end to take a better structure
    [['topic','posts'],['user','users'],['category','categories']].forEach(function(pair){
      var type = pair[0], name = pair[1];
      if(results[name].length > 0) {
        results.resultTypes.push({
          results: results[name],
          displayType: (opts.searchContext && opts.searchContext.type === 'topic' && type === 'topic') ? 'post' : type,
          type: type,
          more: r['more_' + name]
        });
      }
    });

    var noResults = !!(results.topics.length === 0 &&
                       results.posts.length === 0 &&
                       results.users.length === 0 &&
                       results.categories.length === 0);

    return noResults ? null : Em.Object.create(results);
  });
}

export default searchForTerm;
