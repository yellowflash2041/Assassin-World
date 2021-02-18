import { LOADING_ONEBOX_CSS_CLASS, load } from "pretty-text/oneboxer";
import { applyInlineOneboxes } from "pretty-text/inline-oneboxer";

export function loadOneboxes(
  container,
  ajax,
  topicId,
  categoryId,
  maxOneboxes,
  refresh,
  offline
) {
  const oneboxes = {};
  const inlineOneboxes = {};

  // Oneboxes = `a.onebox` -> `a.onebox-loading` -> `aside.onebox`
  // Inline Oneboxes = `a.inline-onebox-loading` -> `a.inline-onebox`

  let loadedOneboxes = container.querySelectorAll(
    `aside.onebox, a.${LOADING_ONEBOX_CSS_CLASS}, a.inline-onebox`
  ).length;

  container
    .querySelectorAll(`a.onebox, a.inline-onebox-loading`)
    .forEach((link) => {
      const text = link.textContent;
      const isInline = link.getAttribute("class") === "inline-onebox-loading";
      const m = isInline ? inlineOneboxes : oneboxes;

      if (loadedOneboxes < maxOneboxes) {
        if (m[text] === undefined) {
          m[text] = [];
          loadedOneboxes++;
        }
        m[text].push(link);
      } else {
        if (m[text] !== undefined) {
          m[text].push(link);
        } else if (isInline) {
          link.classList.remove("inline-onebox-loading");
        }
      }
    });

  if (Object.keys(oneboxes).length > 0) {
    _loadOneboxes({
      oneboxes,
      ajax,
      topicId,
      categoryId,
      refresh,
      offline,
    });
  }

  if (Object.keys(inlineOneboxes).length > 0) {
    _loadInlineOneboxes(inlineOneboxes, ajax, topicId, categoryId);
  }

  return Object.keys(oneboxes).length + Object.keys(inlineOneboxes).length;
}

function _loadInlineOneboxes(inline, ajax, topicId, categoryId) {
  applyInlineOneboxes(inline, ajax, {
    categoryId: topicId,
    topicId: categoryId,
  });
}

function _loadOneboxes({
  oneboxes,
  ajax,
  topicId,
  categoryId,
  refresh,
  offline,
}) {
  Object.values(oneboxes).forEach((onebox) => {
    onebox.forEach((elem) => {
      load({
        elem,
        ajax,
        categoryId,
        topicId,
        refresh,
        offline,
      });
    });
  });
}
