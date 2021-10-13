import { escapeExpression, formatUsername } from "discourse/lib/utilities";
import { deepMerge } from "discourse-common/lib/object";
import I18n from "I18n";
import RawHtml from "discourse/widgets/raw-html";
import { avatarImg } from "discourse/widgets/post";
import { createWidget } from "discourse/widgets/widget";
import { dateNode } from "discourse/helpers/node";
import { emojiUnescape } from "discourse/lib/text";
import getURL from "discourse-common/lib/get-url";
import { h } from "virtual-dom";
import highlightSearch from "discourse/lib/highlight-search";
import { iconNode } from "discourse-common/lib/icon-library";
import renderTag from "discourse/lib/render-tag";
import {
  MODIFIER_REGEXP,
  TOPIC_REPLACE_REGEXP,
} from "discourse/widgets/search-menu";

const suggestionShortcuts = [
  "in:title",
  "in:pinned",
  "status:open",
  "status:closed",
  "status:public",
  "status:noreplies",
  "order:latest",
  "order:views",
  "order:likes",
  "order:latest_topic",
];

const DEFAULT_QUICK_TIPS = [
  {
    label: "#",
    description: I18n.t("search.tips.category_tag"),
    clickable: true,
  },
  {
    label: "@",
    description: I18n.t("search.tips.author"),
    clickable: true,
  },
  {
    label: "in:",
    description: I18n.t("search.tips.in"),
    clickable: true,
  },
  {
    label: "status:",
    description: I18n.t("search.tips.status"),
    clickable: true,
  },
  {
    label: I18n.t("search.tips.full_search_key", { modifier: "Ctrl" }),
    description: I18n.t("search.tips.full_search"),
  },
];

let QUICK_TIPS = [];

export function addSearchSuggestion(value) {
  if (suggestionShortcuts.indexOf(value) === -1) {
    suggestionShortcuts.push(value);
  }
}

export function addQuickSearchRandomTip(tip) {
  if (QUICK_TIPS.indexOf(tip) === -1) {
    QUICK_TIPS.push(tip);
  }
}

export function resetQuickSearchRandomTips() {
  QUICK_TIPS = [].concat(DEFAULT_QUICK_TIPS);
}

resetQuickSearchRandomTips();

class Highlighted extends RawHtml {
  constructor(html, term) {
    super({ html: `<span>${html}</span>` });
    if (term) {
      this.term = term.replace(TOPIC_REPLACE_REGEXP, "");
    }
  }

  decorate($html) {
    highlightSearch($html[0], this.term);
  }
}

function createSearchResult({ type, linkField, builder }) {
  return createWidget(`search-result-${type}`, {
    tagName: "ul.list",

    html(attrs) {
      return attrs.results.map((r) => {
        let searchResultId;

        if (type === "topic") {
          searchResultId = r.topic_id;
        } else {
          searchResultId = r.id;
        }

        return h(
          "li.item",
          this.attach("link", {
            href: r[linkField],
            contents: () => builder.call(this, r, attrs.term),
            className: "search-link",
            searchResultId,
            searchResultType: type,
            searchLogId: attrs.searchLogId,
          })
        );
      });
    },
  });
}

function postResult(result, link, term) {
  const html = [link];

  if (!this.site.mobileView) {
    html.push(
      h("span.blurb", [
        dateNode(result.created_at),
        h("span", " - "),
        this.siteSettings.use_pg_headlines_for_excerpt
          ? new RawHtml({ html: `<span>${result.blurb}</span>` })
          : new Highlighted(result.blurb, term),
      ])
    );
  }

  return html;
}

createSearchResult({
  type: "tag",
  linkField: "url",
  builder(t) {
    const tag = escapeExpression(t.id);
    return [
      iconNode("tag"),
      new RawHtml({ html: renderTag(tag, { tagName: "span" }) }),
    ];
  },
});

createSearchResult({
  type: "category",
  linkField: "url",
  builder(c) {
    return this.attach("category-link", { category: c, link: false });
  },
});

createSearchResult({
  type: "group",
  linkField: "url",
  builder(group) {
    const fullName = escapeExpression(group.fullName);
    const name = escapeExpression(group.name);
    const groupNames = [h("span.name", fullName || name)];

    if (fullName) {
      groupNames.push(h("span.slug", name));
    }

    let avatarFlair;
    if (group.flairUrl) {
      avatarFlair = this.attach("avatar-flair", {
        flair_name: name,
        flair_url: group.flairUrl,
        flair_bg_color: group.flairBgColor,
        flair_color: group.flairColor,
      });
    } else {
      avatarFlair = iconNode("users");
    }

    const groupResultContents = [avatarFlair, h("div.group-names", groupNames)];

    return h("div.group-result", groupResultContents);
  },
});

createSearchResult({
  type: "user",
  linkField: "path",
  builder(u) {
    const userTitles = [];

    if (u.name) {
      userTitles.push(h("span.name", u.name));
    }

    userTitles.push(h("span.username", formatUsername(u.username)));

    if (u.custom_data) {
      u.custom_data.forEach((row) =>
        userTitles.push(h("span.custom-field", `${row.name}: ${row.value}`))
      );
    }

    const userResultContents = [
      avatarImg("small", {
        template: u.avatar_template,
        username: u.username,
      }),
      h("div.user-titles", userTitles),
    ];

    return h("div.user-result", userResultContents);
  },
});

createSearchResult({
  type: "topic",
  linkField: "url",
  builder(result, term) {
    const topic = result.topic;

    const firstLine = [
      this.attach("topic-status", { topic, disableActions: true }),
      h(
        "span.topic-title",
        { attributes: { "data-topic-id": topic.id } },
        this.siteSettings.use_pg_headlines_for_excerpt &&
          result.topic_title_headline
          ? new RawHtml({
              html: `<span>${emojiUnescape(
                result.topic_title_headline
              )}</span>`,
            })
          : new Highlighted(topic.fancyTitle, term)
      ),
    ];

    const secondLine = [
      this.attach("category-link", {
        category: topic.category,
        link: false,
      }),
    ];
    if (this.siteSettings.tagging_enabled) {
      secondLine.push(
        this.attach("discourse-tags", { topic, tagName: "span" })
      );
    }

    const link = h("span.topic", [
      h("span.first-line", firstLine),
      h("span.second-line", secondLine),
    ]);

    return postResult.call(this, result, link, term);
  },
});

createSearchResult({
  type: "post",
  linkField: "url",
  builder(result, term) {
    return postResult.call(
      this,
      result,
      I18n.t("search.post_format", result),
      term
    );
  },
});

createWidget("search-menu-results", {
  tagName: "div.results",

  html(attrs) {
    const { term, suggestionKeyword, results, searchTopics } = attrs;

    if (suggestionKeyword) {
      return this.attach("search-menu-assistant", {
        term,
        suggestionKeyword,
        results: attrs.suggestionResults || [],
      });
    }

    if (searchTopics && attrs.invalidTerm) {
      return h("div.no-results", I18n.t("search.too_short"));
    }

    if (searchTopics && attrs.noResults) {
      return h("div.no-results", I18n.t("search.no_results"));
    }

    if (!term) {
      return this.attach("search-menu-initial-options", {
        term,
      });
    }

    const resultTypes = results.resultTypes || [];

    const mainResultsContent = [];
    const usersAndGroups = [];
    const categoriesAndTags = [];

    const buildMoreNode = (result) => {
      const moreArgs = {
        className: "filter search-link",
        contents: () => [I18n.t("more"), "..."],
      };

      if (result.moreUrl) {
        return this.attach(
          "link",
          deepMerge(moreArgs, {
            href: result.moreUrl,
          })
        );
      } else if (result.more) {
        return this.attach(
          "link",
          deepMerge(moreArgs, {
            action: "moreOfType",
            actionParam: result.type,
          })
        );
      }
    };

    const assignContainer = (result, node) => {
      if (searchTopics) {
        if (["topic"].includes(result.type)) {
          mainResultsContent.push(node);
        }
      } else {
        if (["user", "group"].includes(result.type)) {
          usersAndGroups.push(node);
        }

        if (["category", "tag"].includes(result.type)) {
          categoriesAndTags.push(node);
        }
      }
    };

    resultTypes.forEach((rt) => {
      const resultNodeContents = [
        this.attach(rt.componentName, {
          searchLogId: attrs.results.grouped_search_result.search_log_id,
          results: rt.results,
          term,
        }),
      ];

      if (["topic"].includes(rt.type)) {
        const more = buildMoreNode(rt);
        if (more) {
          resultNodeContents.push(h("div.show-more", more));
        }
      }

      assignContainer(rt, h(`div.${rt.componentName}`, resultNodeContents));
    });

    const content = [];

    if (!searchTopics) {
      content.push(this.attach("search-menu-initial-options", { term }));
    } else {
      if (mainResultsContent.length) {
        content.push(mainResultsContent);
      } else {
        return h("div.no-results", I18n.t("search.no_results"));
      }
    }

    content.push(categoriesAndTags);
    content.push(usersAndGroups);

    return content;
  },
});

createWidget("search-menu-assistant", {
  tagName: "ul.search-menu-assistant",

  html(attrs) {
    if (this.currentUser) {
      addSearchSuggestion("in:likes");
      addSearchSuggestion("in:bookmarks");
      addSearchSuggestion("in:mine");
      addSearchSuggestion("in:personal");
      addSearchSuggestion("in:seen");
      addSearchSuggestion("in:tracking");
      addSearchSuggestion("in:unseen");
      addSearchSuggestion("in:watching");
    }
    if (this.siteSettings.tagging_enabled) {
      addSearchSuggestion("in:tagged");
      addSearchSuggestion("in:untagged");
    }

    const content = [];
    const { suggestionKeyword, term } = attrs;
    let prefix = term?.split(suggestionKeyword)[0].trim() || "";

    if (prefix.length) {
      prefix = `${prefix} `;
    }

    switch (suggestionKeyword) {
      case "#":
        attrs.results.forEach((item) => {
          if (item.model) {
            const fullSlug = item.model.parentCategory
              ? `#${item.model.parentCategory.slug}:${item.model.slug}`
              : `#${item.model.slug}`;

            content.push(
              this.attach("search-menu-assistant-item", {
                prefix,
                category: item.model,
                slug: `${prefix}${fullSlug}`,
                withInLabel: attrs.withInLabel,
              })
            );
          } else {
            content.push(
              this.attach("search-menu-assistant-item", {
                prefix,
                tag: item.name,
                slug: `${prefix}#${item.name}`,
                withInLabel: attrs.withInLabel,
              })
            );
          }
        });
        break;
      case "@":
        attrs.results.forEach((user) => {
          content.push(
            this.attach("search-menu-assistant-item", {
              prefix,
              user,
              slug: `${prefix}@${user.username}`,
            })
          );
        });
        break;
      default:
        suggestionShortcuts.forEach((item) => {
          if (item.includes(suggestionKeyword) || !suggestionKeyword) {
            content.push(
              this.attach("search-menu-assistant-item", {
                slug: `${prefix}${item}`,
              })
            );
          }
        });
        break;
    }

    return content.filter((c, i) => i <= 8);
  },
});

createWidget("search-menu-initial-options", {
  tagName: "ul.search-menu-initial-options",

  html(attrs) {
    if (attrs.term?.match(MODIFIER_REGEXP)) {
      return this.defaultRow(attrs.term);
    }

    const service = this.register.lookup("search-service:main");
    const ctx = service.get("searchContext");

    const content = [];

    if (attrs.term || ctx) {
      if (ctx) {
        const term = attrs.term ? `${attrs.term} ` : "";

        switch (ctx.type) {
          case "topic":
            content.push(
              this.attach("search-menu-assistant-item", {
                slug: `${term}topic:${ctx.id}`,
                label: [
                  h("span", term),
                  h("span.label-suffix", I18n.t("search.in_this_topic")),
                ],
              })
            );
            break;

          case "private_messages":
            content.push(
              this.attach("search-menu-assistant-item", {
                slug: `${term}in:personal`,
              })
            );
            break;

          case "category":
            const fullSlug = ctx.category.parentCategory
              ? `#${ctx.category.parentCategory.slug}:${ctx.category.slug}`
              : `#${ctx.category.slug}`;

            content.push(
              this.attach("search-menu-assistant", {
                term: `${term}${fullSlug}`,
                suggestionKeyword: "#",
                results: [{ model: ctx.category }],
                withInLabel: true,
              })
            );

            break;
          case "tag":
            content.push(
              this.attach("search-menu-assistant", {
                term: `${term}#${ctx.name}`,
                suggestionKeyword: "#",
                results: [{ name: ctx.name }],
                withInLabel: true,
              })
            );
            break;
          case "user":
            content.push(
              this.attach("search-menu-assistant-item", {
                slug: `${term}@${ctx.user.username}`,
                label: [
                  h("span", term),
                  h(
                    "span.label-suffix",
                    I18n.t("search.in_posts_by", {
                      username: ctx.user.username,
                    })
                  ),
                ],
              })
            );
            break;
        }
      }

      if (attrs.term) {
        content.push(this.defaultRow(attrs.term, { withLabel: true }));
      }
      return content;
    }

    if (content.length === 0) {
      content.push(this.attach("random-quick-tip"));
    }

    return content;
  },

  defaultRow(term, opts = { withLabel: false }) {
    return this.attach("search-menu-assistant-item", {
      slug: term,
      extraHint: I18n.t("search.enter_hint"),
      label: [
        h("span.keyword", `${term} `),
        opts.withLabel
          ? h("span.label-suffix", I18n.t("search.in_topics_posts"))
          : null,
      ],
    });
  },
});

createWidget("search-menu-assistant-item", {
  tagName: "li.search-menu-assistant-item",

  html(attrs) {
    const prefix = attrs.prefix?.trim();
    const attributes = {};
    attributes.href = "#";

    let content = [iconNode("search")];

    if (prefix) {
      content.push(h("span.search-item-prefix", `${prefix} `));
    }

    if (attrs.withInLabel) {
      content.push(h("span.label-suffix", `${I18n.t("search.in")} `));
    }

    if (attrs.category) {
      attributes.href = attrs.category.url;

      content.push(
        this.attach("category-link", {
          category: attrs.category,
          allowUncategorized: true,
          recursive: true,
          link: false,
        })
      );
    } else if (attrs.tag) {
      attributes.href = getURL(`/tag/${attrs.tag}`);

      content.push(iconNode("tag"));
      content.push(h("span.search-item-tag", attrs.tag));
    } else if (attrs.user) {
      const userResult = [
        avatarImg("small", {
          template: attrs.user.avatar_template,
          username: attrs.user.username,
        }),
        h("span.username", formatUsername(attrs.user.username)),
      ];
      content.push(h("span.search-item-user", userResult));
    } else {
      content.push(h("span.search-item-slug", attrs.label || attrs.slug));
      if (attrs.extraHint) {
        content.push(h("span.extra-hint", attrs.extraHint));
      }
    }
    return h("a.widget-link.search-link", { attributes }, content);
  },

  click(e) {
    const searchInput = document.querySelector("#search-term");
    searchInput.value = this.attrs.slug;
    searchInput.focus();
    this.sendWidgetAction("triggerAutocomplete", {
      value: this.attrs.slug,
      searchTopics: true,
    });
    e.preventDefault();
    return false;
  },
});

createWidget("random-quick-tip", {
  tagName: "li.search-random-quick-tip",

  buildKey: () => "random-quick-tip",

  defaultState() {
    return QUICK_TIPS[Math.floor(Math.random() * QUICK_TIPS.length)];
  },

  html(attrs, state) {
    return [
      h(
        `span.tip-label${state.clickable ? ".tip-clickable" : ""}`,
        state.label
      ),
      h("span.tip-description", state.description),
    ];
  },

  click(e) {
    if (e.target.classList.contains("tip-clickable")) {
      const searchInput = document.querySelector("#search-term");
      searchInput.value = this.state.label;
      searchInput.focus();
      this.sendWidgetAction("triggerAutocomplete", {
        value: this.state.label,
        searchTopics: this.state.searchTopics,
      });
    }
  },
});
