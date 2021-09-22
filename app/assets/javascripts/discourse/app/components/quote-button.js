import afterTransition from "discourse/lib/after-transition";
import { propertyEqual } from "discourse/lib/computed";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import {
  postUrl,
  selectedElement,
  selectedText,
  setCaretPosition,
} from "discourse/lib/utilities";
import Component from "@ember/component";
import { INPUT_DELAY } from "discourse-common/config/environment";
import Sharing from "discourse/lib/sharing";
import { action } from "@ember/object";
import { alias } from "@ember/object/computed";
import discourseComputed from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import { getAbsoluteURL } from "discourse-common/lib/get-url";
import { schedule } from "@ember/runloop";
import toMarkdown from "discourse/lib/to-markdown";

function getQuoteTitle(element) {
  const titleEl = element.querySelector(".title");
  if (!titleEl) {
    return;
  }

  const titleLink = titleEl.querySelector("a:not(.back)");
  if (titleLink) {
    return titleLink.textContent.trim();
  }

  return titleEl.textContent.trim().replace(/:$/, "");
}

function fixQuotes(str) {
  return str.replace(/„|“|«|»|”/g, '"').replace(/‘|’/g, "'");
}

function regexSafeStr(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default Component.extend({
  classNames: ["quote-button"],
  classNameBindings: ["visible", "_displayFastEditInput:fast-editing"],
  visible: false,
  privateCategory: alias("topic.category.read_restricted"),
  editPost: null,

  _isFastEditable: false,
  _displayFastEditInput: false,
  _fastEditInitalSelection: null,
  _fastEditNewSelection: null,
  _isSavingFastEdit: false,
  _canEditPost: false,

  _isMouseDown: false,
  _reselected: false,

  _hideButton() {
    this.quoteState.clear();
    this.set("visible", false);

    this.set("_isFastEditable", false);
    this.set("_displayFastEditInput", false);
    this.set("_fastEditInitalSelection", null);
    this.set("_fastEditNewSelection", null);
  },

  _selectionChanged() {
    if (this._displayFastEditInput) {
      return;
    }

    const quoteState = this.quoteState;

    const selection = window.getSelection();
    if (selection.isCollapsed) {
      if (this.visible) {
        this._hideButton();
      }
      return;
    }

    // ensure we selected content inside 1 post *only*
    let firstRange, postId;
    for (let r = 0; r < selection.rangeCount; r++) {
      const range = selection.getRangeAt(r);
      const $selectionStart = $(range.startContainer);
      const $ancestor = $(range.commonAncestorContainer);

      if ($selectionStart.closest(".cooked").length === 0) {
        return;
      }

      firstRange = firstRange || range;
      postId = postId || $ancestor.closest(".boxed, .reply").data("post-id");

      if ($ancestor.closest(".contents").length === 0 || !postId) {
        if (this.visible) {
          this._hideButton();
        }
        return;
      }
    }

    const _selectedElement = selectedElement();
    const _selectedText = selectedText();

    const $selectedElement = $(_selectedElement);
    const cooked =
      $selectedElement.find(".cooked")[0] ||
      $selectedElement.closest(".cooked")[0];
    const postBody = toMarkdown(cooked.innerHTML);

    let opts = {
      full: _selectedText === postBody,
    };

    for (
      let element = _selectedElement;
      element && element.tagName !== "ARTICLE";
      element = element.parentElement
    ) {
      if (element.tagName === "ASIDE" && element.classList.contains("quote")) {
        opts.username = element.dataset.username || getQuoteTitle(element);
        opts.post = element.dataset.post;
        opts.topic = element.dataset.topic;
        break;
      }
    }

    quoteState.selected(postId, _selectedText, opts);
    this.set("visible", quoteState.buffer.length > 0);

    if (this.siteSettings.enable_fast_edit) {
      this.set(
        "_canEditPost",
        this.topic.postStream.findLoadedPost(postId)?.can_edit
      );

      const regexp = new RegExp(regexSafeStr(quoteState.buffer), "gi");
      const matches = postBody.match(regexp);

      if (
        quoteState.buffer.length < 1 ||
        quoteState.buffer.includes("|") || // tables are too complex
        quoteState.buffer.match(/\n/g) || // linebreaks are too complex
        matches?.length > 1 // duplicates are too complex
      ) {
        this.set("_isFastEditable", false);
        this.set("_fastEditInitalSelection", null);
        this.set("_fastEditNewSelection", null);
      } else if (matches?.length === 1) {
        this.set("_isFastEditable", true);
        this.set("_fastEditInitalSelection", quoteState.buffer);
        this.set("_fastEditNewSelection", quoteState.buffer);
      }
    }

    // avoid hard loops in quote selection unconditionally
    // this can happen if you triple click text in firefox
    if (this._prevSelection === _selectedText) {
      return;
    }

    this._prevSelection = _selectedText;

    // on Desktop, shows the button at the beginning of the selection
    // on Mobile, shows the button at the end of the selection
    const isMobileDevice = this.site.isMobileDevice;
    const { isIOS, isAndroid, isSafari, isOpera } = this.capabilities;
    const showAtEnd = isMobileDevice || isIOS || isAndroid || isOpera;

    // Don't mess with the original range as it results in weird behaviours
    // where certain browsers will deselect the selection
    const clone = firstRange.cloneRange();

    // create a marker element containing a single invisible character
    const markerElement = document.createElement("span");
    markerElement.appendChild(document.createTextNode("\ufeff"));

    // on mobile, collapse the range at the end of the selection
    if (showAtEnd) {
      clone.collapse();
    }
    // insert the marker
    clone.insertNode(markerElement);

    // retrieve the position of the marker
    const $markerElement = $(markerElement);
    const markerOffset = $markerElement.offset();
    const parentScrollLeft = $markerElement.parent().scrollLeft();
    const $quoteButton = $(this.element);

    // remove the marker
    const parent = markerElement.parentNode;
    parent.removeChild(markerElement);
    // merge back all text nodes so they don't get messed up
    parent.normalize();

    // work around Safari that would sometimes lose the selection
    if (isSafari) {
      this._reselected = true;
      selection.removeAllRanges();
      selection.addRange(clone);
    }

    // change the position of the button
    schedule("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      let top = markerOffset.top;
      let left = markerOffset.left + Math.max(0, parentScrollLeft);
      if (showAtEnd) {
        top = top + 25;
        left = Math.min(
          left + 10,
          window.innerWidth - this.element.clientWidth - 10
        );
      } else {
        top = top - $quoteButton.outerHeight() - 5;
      }

      $quoteButton.offset({ top, left });
    });
  },

  didInsertElement() {
    this._super(...arguments);

    const { isWinphone, isAndroid } = this.capabilities;
    const wait = isWinphone || isAndroid ? INPUT_DELAY : 25;
    const onSelectionChanged = () => {
      discourseDebounce(this, this._selectionChanged, wait);
    };

    $(document)
      .on("mousedown.quote-button", (e) => {
        this._prevSelection = null;
        this._isMouseDown = true;
        this._reselected = false;

        // prevents fast-edit input event to trigger mousedown
        if (e.target.classList.contains("fast-edit-input")) {
          return;
        }

        if (
          $(e.target).closest(".quote-button, .create, .share, .reply-new")
            .length === 0
        ) {
          this._hideButton();
        }
      })
      .on("mouseup.quote-button", (e) => {
        // prevents fast-edit input event to trigger mouseup
        if (e.target.classList.contains("fast-edit-input")) {
          return;
        }

        this._prevSelection = null;
        this._isMouseDown = false;
        onSelectionChanged();
      })
      .on("selectionchange.quote-button", () => {
        if (!this._isMouseDown && !this._reselected) {
          onSelectionChanged();
        }
      });
  },

  willDestroyElement() {
    $(document)
      .off("mousedown.quote-button")
      .off("mouseup.quote-button")
      .off("selectionchange.quote-button");
  },

  @discourseComputed("topic.{isPrivateMessage,invisible,category}")
  quoteSharingEnabled(topic) {
    if (
      this.site.mobileView ||
      this.siteSettings.share_quote_visibility === "none" ||
      (this.currentUser &&
        this.siteSettings.share_quote_visibility === "anonymous") ||
      this.quoteSharingSources.length === 0 ||
      this.privateCategory ||
      (this.currentUser && topic.invisible)
    ) {
      return false;
    }

    return true;
  },

  @discourseComputed("topic.isPrivateMessage")
  quoteSharingSources(isPM) {
    return Sharing.activeSources(
      this.siteSettings.share_quote_buttons,
      this.siteSettings.login_required || isPM
    );
  },

  @discourseComputed("topic.{isPrivateMessage,invisible,category}")
  quoteSharingShowLabel() {
    return this.quoteSharingSources.length > 1;
  },

  @discourseComputed("topic.{id,slug}", "quoteState")
  shareUrl(topic, quoteState) {
    const postId = quoteState.postId;
    const postNumber = topic.postStream.findLoadedPost(postId).post_number;
    return getAbsoluteURL(postUrl(topic.slug, topic.id, postNumber));
  },

  @discourseComputed("topic.details.can_create_post", "composerVisible")
  embedQuoteButton(canCreatePost, composerOpened) {
    return (
      (canCreatePost || composerOpened) &&
      this.currentUser &&
      this.currentUser.get("enable_quoting")
    );
  },

  _saveFastEditDisabled: propertyEqual(
    "_fastEditInitalSelection",
    "_fastEditNewSelection"
  ),

  @action
  insertQuote() {
    this.attrs.selectText().then(() => this._hideButton());
  },

  @action
  _toggleFastEditForm() {
    if (this._isFastEditable) {
      this.toggleProperty("_displayFastEditInput");

      schedule("afterRender", () => {
        if (this.site.mobileView) {
          this.element.style.left = `${
            (window.innerWidth - this.element.clientWidth) / 2
          }px`;
        }
        document.querySelector("#fast-edit-input")?.focus();
      });
    } else {
      const postId = this.quoteState.postId;
      const postModel = this.topic.postStream.findLoadedPost(postId);
      return ajax(`/posts/${postModel.id}`, { type: "GET", cache: false }).then(
        (result) => {
          let bestIndex = 0;
          const rows = result.raw.split("\n");

          // selecting even a part of the text of a list item will include
          // "* " at the beginning of the buffer, we remove it to be able
          // to find it in row
          const buffer = fixQuotes(
            this.quoteState.buffer.split("\n")[0].replace(/^\* /, "")
          );

          rows.some((row, index) => {
            if (row.length && row.includes(buffer)) {
              bestIndex = index;
              return true;
            }
          });

          this?.editPost(postModel);

          afterTransition(document.querySelector("#reply-control"), () => {
            const textarea = document.querySelector(".d-editor-input");
            if (!textarea || this.isDestroyed || this.isDestroying) {
              return;
            }

            // best index brings us to one row before as slice start from 1
            // we add 1 to be at the beginning of next line, unless we start from top
            setCaretPosition(
              textarea,
              rows.slice(0, bestIndex).join("\n").length +
                (bestIndex > 0 ? 1 : 0)
            );

            // ensures we correctly scroll to caret and reloads composer
            // if we do another selection/edit
            textarea.blur();
            textarea.focus();
          });
        }
      );
    }
  },

  @action
  _saveFastEdit() {
    const postId = this.quoteState?.postId;
    const postModel = this.topic.postStream.findLoadedPost(postId);

    this.set("_isSavingFastEdit", true);

    return ajax(`/posts/${postModel.id}`, { type: "GET", cache: false })
      .then((result) => {
        const newRaw = result.raw.replace(
          fixQuotes(this._fastEditInitalSelection),
          fixQuotes(this._fastEditNewSelection)
        );

        postModel
          .save({ raw: newRaw })
          .catch(popupAjaxError)
          .finally(() => {
            this.set("_isSavingFastEdit", false);
            this._hideButton();
          });
      })
      .catch(popupAjaxError);
  },

  @action
  share(source) {
    Sharing.shareSource(source, {
      url: this.shareUrl,
      title: this.topic.title,
      quote: window.getSelection().toString(),
    });
  },
});
