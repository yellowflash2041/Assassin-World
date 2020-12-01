import DiscourseRoute from "discourse/routes/discourse";
import DiscourseURL from "discourse/lib/url";
import { ajax } from "discourse/lib/ajax";

export default DiscourseRoute.extend({
  model(params, transition) {
    const path = params.path;
    return ajax("/permalink-check.json", {
      data: { path },
    }).then((results) => {
      if (results.found) {
        // Avoid polluting the history stack for external links
        transition.abort();

        let url = results.target_url;

        if (transition._discourse_anchor) {
          // Remove the anchor from the permalink if present
          url = url.split("#")[0];

          // Add the anchor from the transition
          url += `#${transition._discourse_anchor}`;
        }

        DiscourseURL.routeTo(url);
        return "";
      } else {
        // 404 body HTML
        return results.html;
      }
    });
  },
});
