import highlightSyntax from "discourse/lib/highlight-syntax";
import lightbox from "discourse/lib/lightbox";
import { setTextDirections } from "discourse/lib/text-direction";
import { setupLazyLoading } from "discourse/lib/lazy-load-images";
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "post-decorations",
  initialize(container) {
    withPluginApi("0.1", (api) => {
      const siteSettings = container.lookup("site-settings:main");
      const session = container.lookup("session:main");
      api.decorateCookedElement(
        (elem) => {
          return highlightSyntax(elem, siteSettings, session);
        },
        {
          id: "discourse-syntax-highlighting",
        }
      );

      api.decorateCookedElement(
        (elem) => {
          return lightbox(elem, siteSettings);
        },
        { id: "discourse-lightbox" }
      );
      api.decorateCookedElement(lightbox, { id: "discourse-lightbox" });
      if (siteSettings.support_mixed_text_direction) {
        api.decorateCooked(setTextDirections, {
          id: "discourse-text-direction",
        });
      }

      setupLazyLoading(api);

      api.decorateCooked(
        ($elem) => {
          const players = $("audio", $elem);
          if (players.length) {
            players.on("play", () => {
              const postId = parseInt(
                $elem.closest("article").data("post-id"),
                10
              );
              if (postId) {
                api.preventCloak(postId);
              }
            });
          }
        },
        { id: "discourse-audio" }
      );

      const caps = container.lookup("capabilities:main");
      if (caps.isSafari || caps.isIOS) {
        api.decorateCookedElement(
          (elem) => {
            elem.querySelectorAll("video").forEach((video) => {
              if (video.poster && video.poster !== "" && !video.autoplay) {
                return;
              }

              const source = video.querySelector("source");
              if (source) {
                // In post-cooked.js, we create the video element in a detached DOM
                // then adopt it into to the real DOM.
                // This confuses safari, and preloading/autoplay do not happen.

                // Calling `.load()` tricks Safari into loading the video element correctly
                source.parentElement.load();
              }
            });
          },
          { id: "safari-video-poster", afterAdopt: true, onlyStream: true }
        );
      }
    });
  },
};
