import { getAbsoluteURL } from "discourse-common/lib/get-url";

export default {
  name: "opengraph-tag-updater",

  initialize(container) {
    // workaround for Safari on iOS 14.3
    // seems it has started using opengraph tags when sharing
    this.appEvents = container.lookup("service:app-events");
    this.ogTitle = document.querySelector("meta[property='og:title']");
    this.ogUrl = document.querySelector("meta[property='og:url']");

    if (this.ogTitle && this.ogUrl) {
      this.appEvents.on("page:changed", this, this.updateOgAttributes);
    }
  },

  updateOgAttributes(data) {
    this.ogTitle.setAttribute("content", data.title);
    this.ogUrl.setAttribute("content", getAbsoluteURL(data.url));
  },

  teardown() {
    this.appEvents.off("page:changed", this, this.updateOgAttributes);
  },
};
