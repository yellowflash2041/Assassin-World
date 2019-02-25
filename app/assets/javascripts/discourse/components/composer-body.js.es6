import {
  default as computed,
  observes
} from "ember-addons/ember-computed-decorators";
import Composer from "discourse/models/composer";
import afterTransition from "discourse/lib/after-transition";
import positioningWorkaround from "discourse/lib/safari-hacks";
import { headerHeight } from "discourse/components/site-header";
import KeyEnterEscape from "discourse/mixins/key-enter-escape";

const START_EVENTS = "touchstart mousedown";
const DRAG_EVENTS = "touchmove mousemove";
const END_EVENTS = "touchend mouseup";

const MIN_COMPOSER_SIZE = 240;
const THROTTLE_RATE = 20;

function mouseYPos(e) {
  return e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
}

export default Ember.Component.extend(KeyEnterEscape, {
  elementId: "reply-control",

  classNameBindings: [
    "composer.creatingPrivateMessage:private-message",
    "composeState",
    "composer.loading",
    "composer.canEditTitle:edit-title",
    "composer.createdPost:created-post",
    "composer.creatingTopic:topic",
    "composer.whisper:composing-whisper",
    "composer.sharedDraft:composing-shared-draft",
    "showPreview:show-preview:hide-preview",
    "currentUserPrimaryGroupClass"
  ],

  @computed("currentUser.primary_group_name")
  currentUserPrimaryGroupClass(primaryGroupName) {
    return primaryGroupName && `group-${primaryGroupName}`;
  },

  @computed("composer.composeState")
  composeState(composeState) {
    return composeState || Composer.CLOSED;
  },

  movePanels(sizePx) {
    $("#main-outlet").css("padding-bottom", sizePx);

    // signal the progress bar it should move!
    this.appEvents.trigger("composer:resized");
  },

  @observes(
    "composeState",
    "composer.action",
    "composer.canEditTopicFeaturedLink"
  )
  resize() {
    Ember.run.scheduleOnce("afterRender", () => {
      if (!this.element || this.isDestroying || this.isDestroyed) {
        return;
      }

      const h = $("#reply-control").height() || 0;
      this.movePanels(h + "px");
    });
  },

  keyUp() {
    this.typed();

    const lastKeyUp = new Date();
    this._lastKeyUp = lastKeyUp;

    // One second from now, check to see if the last key was hit when
    // we recorded it. If it was, the user paused typing.
    Ember.run.cancel(this._lastKeyTimeout);
    this._lastKeyTimeout = Ember.run.later(() => {
      if (lastKeyUp !== this._lastKeyUp) {
        return;
      }
      this.appEvents.trigger("composer:find-similar");
    }, 1000);
  },

  @observes("composeState")
  disableFullscreen() {
    if (
      this.get("composeState") !== Composer.OPEN &&
      positioningWorkaround.blur
    ) {
      positioningWorkaround.blur();
    }
  },

  setupComposerResizeEvents() {
    const $composer = this.$();
    const $grippie = this.$(".grippie");
    const $document = Ember.$(document);
    let origComposerSize = 0;
    let lastMousePos = 0;

    const performDrag = event => {
      $composer.trigger("div-resizing");
      $composer.addClass("clear-transitions");
      const currentMousePos = mouseYPos(event);
      let size = origComposerSize + (lastMousePos - currentMousePos);

      const winHeight = Ember.$(window).height();
      size = Math.min(size, winHeight - headerHeight());
      size = Math.max(size, MIN_COMPOSER_SIZE);
      const sizePx = `${size}px`;
      this.movePanels(sizePx);
      $composer.height(sizePx);
    };

    const throttledPerformDrag = (event => {
      event.preventDefault();
      Ember.run.throttle(this, performDrag, event, THROTTLE_RATE);
    }).bind(this);

    const endDrag = () => {
      $document.off(DRAG_EVENTS, throttledPerformDrag);
      $document.off(END_EVENTS, endDrag);
      $composer.removeClass("clear-transitions");
      $composer.focus();
    };

    $grippie.on(START_EVENTS, event => {
      event.preventDefault();
      origComposerSize = $composer.height();
      lastMousePos = mouseYPos(event);
      $document.on(DRAG_EVENTS, throttledPerformDrag);
      $document.on(END_EVENTS, endDrag);
    });
  },

  didInsertElement() {
    this._super(...arguments);
    this.setupComposerResizeEvents();

    const resize = () => Ember.run(() => this.resize());
    const triggerOpen = () => {
      if (this.get("composer.composeState") === Composer.OPEN) {
        this.appEvents.trigger("composer:opened");
      }
    };
    triggerOpen();

    afterTransition(this.$(), () => {
      resize();
      triggerOpen();
    });
    positioningWorkaround(this.$());
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("composer:resize", this, this.resize);
  },

  click() {
    this.openIfDraft();
  }
});
