import registerUnbound from 'discourse/helpers/register-unbound';
import { runFilters } from 'discourse/lib/filter';

registerUnbound('topic-link', function(topic) {
  var title = topic.get('fancyTitle');
  var url = topic.linked_post_number ? topic.urlForPostNumber(topic.linked_post_number) : topic.get('lastUnreadUrl');

  var extraClass = topic.get('last_read_post_number') === topic.get('highest_post_number') ? " visited" : "";
  var string = "<a href='" + url + "' class='title" + extraClass + "'>" + title + "</a>";

  string = runFilters('topic-link', string, topic);

  return new Handlebars.SafeString(string);
});
