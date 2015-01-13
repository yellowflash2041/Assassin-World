/**
  If you want to add a new sharing source to Discourse, you can do so like this:

  ```javascript
    import Sharing from 'discourse/lib/sharing';

    Sharing.addSource({

      // This id must be present in the `share_links` site setting too
      id: 'twitter',

      // The icon that will be displayed
      iconClass: 'fa-twitter-square',

      // A callback for generating the remote link from the `link` and `title`
      generateUrl: function(link, title) {
        return "http://twitter.com/intent/tweet?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(title);
      },

      // If true, opens in a popup of `popupHeight` size. If false it's opened in a new tab
      shouldOpenInPopup: true,
      popupHeight: 265
    });
  ```
**/

var _sources = [];

export default {
  addSource: function (source) {
    _sources.push(source);
  },

  activeSources: function() {
    var enabled = Discourse.SiteSettings.share_links.split('|');
    return _sources.filter(function(s) {
      return enabled.indexOf(s.id) !== -1;
    });
  }
};
