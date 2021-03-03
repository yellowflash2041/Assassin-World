import { helperContext } from "discourse-common/lib/helpers";

export function prioritizeNameInUx(name) {
  let siteSettings = helperContext().siteSettings;

  return (
    !siteSettings.prioritize_username_in_ux && name && name.trim().length > 0
  );
}

export function emojiBasePath() {
  let siteSettings = helperContext().siteSettings;

  return siteSettings.external_emoji_url === ""
    ? "/images/emoji"
    : siteSettings.external_emoji_url;
}
