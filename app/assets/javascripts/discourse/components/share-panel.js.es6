import { escapeExpression } from "discourse/lib/utilities";
import { default as computed } from "ember-addons/ember-computed-decorators";
import Sharing from "discourse/lib/sharing";

export default Ember.Component.extend({
  tagName: null,

  type: Ember.computed.alias("panel.model.type"),

  topic: Ember.computed.alias("panel.model.topic"),

  @computed
  sources() {
    return Sharing.activeSources(this.siteSettings.share_links);
  },

  @computed("type", "topic.title")
  shareTitle(type, topicTitle) {
    topicTitle = escapeExpression(topicTitle);
    return I18n.t("share.topic_html", { topicTitle });
  },

  @computed("panel.model.shareUrl", "topic.shareUrl")
  shareUrl(forcedShareUrl, shareUrl) {
    shareUrl = forcedShareUrl || shareUrl;

    if (Ember.isEmpty(shareUrl)) {
      return;
    }

    // Relative urls
    if (shareUrl.indexOf("/") === 0) {
      const location = window.location;
      shareUrl = `${location.protocol}//${location.host}${shareUrl}`;
    }

    return encodeURI(shareUrl);
  },

  didInsertElement() {
    this._super(...arguments);

    const shareUrl = this.get("shareUrl");
    const $linkInput = this.$(".topic-share-url");
    const $linkForTouch = this.$(".topic-share-url-for-touch a");

    Ember.run.schedule("afterRender", () => {
      if (!this.capabilities.touch) {
        $linkForTouch.parent().remove();

        $linkInput
          .val(shareUrl)
          .select()
          .focus();
      } else {
        $linkInput.remove();

        $linkForTouch.attr("href", shareUrl).text(shareUrl);

        const range = window.document.createRange();
        range.selectNode($linkForTouch[0]);
        window.getSelection().addRange(range);
      }
    });
  },

  actions: {
    share(source) {
      Sharing.shareSource(source, {
        url: this.get("shareUrl"),
        title: this.get("topic.title")
      });
    }
  }
});
