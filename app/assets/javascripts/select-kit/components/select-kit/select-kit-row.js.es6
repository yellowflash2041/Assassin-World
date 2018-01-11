import { on } from 'ember-addons/ember-computed-decorators';
import computed from 'ember-addons/ember-computed-decorators';
const { run, isPresent, makeArray, isEmpty } = Ember;
import UtilsMixin from "select-kit/mixins/utils";

export default Ember.Component.extend(UtilsMixin, {
  layoutName: "select-kit/templates/components/select-kit/select-kit-row",
  classNames: ["select-kit-row", "select-box-kit-row"],
  tagName: "li",
  tabIndex: -1,
  attributeBindings: [
    "tabIndex",
    "title",
    "value:data-value",
    "name:data-name",
    "ariaLabel:aria-label"
  ],
  classNameBindings: ["isHighlighted", "isSelected"],

  ariaLabel: Ember.computed.or("computedContent.ariaLabel", "title"),

  @computed("computedContent.title", "name")
  title(computedContentTitle, name) {
    if (computedContentTitle) return computedContentTitle;
    if (name) return name;

    return null;
  },

  label: Ember.computed.or("computedContent.label", "title", "name"),

  name: Ember.computed.alias("computedContent.name"),

  value: Ember.computed.alias("computedContent.value"),

  @computed("templateForRow")
  template(templateForRow) { return templateForRow(this); },

  @on("didReceiveAttrs")
  _setSelectionState() {
    this.set("isSelected", this.get("computedValue") === this.get("value"));
    this.set("isHighlighted", this.get("highlightedValue") === this.get("value"));
  },

  @on("willDestroyElement")
  _clearDebounce() {
    const hoverDebounce = this.get("hoverDebounce");
    if (isPresent(hoverDebounce)) { run.cancel(hoverDebounce); }
  },

  @computed("computedContent.icon", "computedContent.icons", "computedContent.originalContent.icon")
  icons(icon, icons, originalIcon) {
    return makeArray(icon)
            .concat(icons)
            .concat(makeArray(originalIcon))
            .filter(i => !isEmpty(i));
  },

  mouseEnter() {
    this.set("hoverDebounce", run.debounce(this, this._sendHighlightAction, 32));
  },

  click() {
    this.sendAction("select", this.get("computedContent"));
  },

  _sendHighlightAction() {
    this.sendAction("highlight", this.get("computedContent"));
  }
});
