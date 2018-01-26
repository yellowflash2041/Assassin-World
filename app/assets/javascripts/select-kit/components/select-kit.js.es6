const { isNone, run } = Ember;
import computed from "ember-addons/ember-computed-decorators";
import UtilsMixin from "select-kit/mixins/utils";
import DomHelpersMixin from "select-kit/mixins/dom-helpers";
import EventsMixin from "select-kit/mixins/events";
import PluginApiMixin from "select-kit/mixins/plugin-api";
import {
  applyContentPluginApiCallbacks,
  applyHeaderContentPluginApiCallbacks,
  applyOnSelectPluginApiCallbacks,
  applyCollectionHeaderCallbacks
} from "select-kit/mixins/plugin-api";

export default Ember.Component.extend(UtilsMixin, PluginApiMixin, DomHelpersMixin, EventsMixin, {
  pluginApiIdentifiers: ["select-kit"],
  layoutName: "select-kit/templates/components/select-kit",
  classNames: ["select-kit", "select-box-kit"],
  classNameBindings: [
    "isFocused",
    "isExpanded",
    "isDisabled",
    "isHidden",
    "isAbove",
    "isBelow",
    "isLeftAligned",
    "isRightAligned",
    "hasSelection",
  ],
  isDisabled: false,
  isExpanded: false,
  isFocused: false,
  isHidden: false,
  renderedBodyOnce: false,
  renderedFilterOnce: false,
  tabindex: 0,
  none: null,
  highlightedValue: null,
  noContentLabel: "select_kit.no_content",
  valueAttribute: "id",
  nameProperty: "name",
  autoFilterable: false,
  filterable: false,
  filter: "",
  filterPlaceholder: "select_kit.filter_placeholder",
  filterIcon: "search",
  headerIcon: null,
  rowComponent: "select-kit/select-kit-row",
  rowComponentOptions: null,
  noneRowComponent: "select-kit/select-kit-none-row",
  createRowComponent: "select-kit/select-kit-create-row",
  filterComponent: "select-kit/select-kit-filter",
  headerComponent: "select-kit/select-kit-header",
  headerComponentOptions: null,
  headerComputedContent: null,
  collectionHeaderComputedContent: null,
  collectionComponent: "select-kit/select-kit-collection",
  collectionHeight: 200,
  verticalOffset: 0,
  horizontalOffset: 0,
  fullWidthOnMobile: false,
  castInteger: false,
  allowAny: false,
  allowInitialValueMutation: false,
  content: null,
  computedContent: null,
  limitMatches: null,
  nameChanges: false,
  allowContentReplacement: false,
  collectionHeader: null,
  allowAutoSelectFirst: true,

  init() {
    this._super();

    this.noneValue = "__none__";
    this.set("headerComponentOptions", Ember.Object.create());
    this.set("rowComponentOptions", Ember.Object.create());
    this.set("computedContent", []);

    if (this.site && this.site.isMobileDevice) {
      this.setProperties({ filterable: false, autoFilterable: false });
    }

    if (this.get("nameChanges")) {
      this.addObserver(`content.@each.${this.get("nameProperty")}`, this, this._compute);
    }

    if (this.get("allowContentReplacement")) {
      this.addObserver(`content.[]`, this, this._compute);
    }
  },

  willDestroyElement() {
    this.removeObserver(`content.@each.${this.get("nameProperty")}`, this, this._compute);
    this.removeObserver(`content.[]`, this, this._compute);
  },

  willComputeAttributes() {},
  didComputeAttributes() {},

  willComputeContent(content) { return content; },
  computeContent(content) { return content; },
  _beforeDidComputeContent(content) {
    content = applyContentPluginApiCallbacks(this.get("pluginApiIdentifiers"), content, this);

    const existingCreatedComputedContent = this.get("computedContent").filterBy("created", true);
    this.setProperties({
      computedContent: content.map(c => this.computeContentItem(c)).concat(existingCreatedComputedContent)
    });
    return content;
  },
  didComputeContent() {},

  computeHeaderContent() {
    return this.baseHeaderComputedContent();
  },

  computeContentItem(contentItem, options) {
    return this.baseComputedContentItem(contentItem, options);
  },

  baseComputedContentItem(contentItem, options) {
    let originalContent;
    options = options || {};
    const name = options.name;

    if (typeof contentItem === "string" || typeof contentItem === "number") {
      originalContent = {};
      originalContent[this.get("valueAttribute")] = contentItem;
      originalContent[this.get("nameProperty")] = name || contentItem;
    } else {
      originalContent = contentItem;
    }

    return {
      value: this._castInteger(this.valueForContentItem(contentItem)),
      name: name || this._nameForContent(contentItem),
      locked: false,
      created: options.created || false,
      originalContent
    };
  },

  @computed("shouldFilter", "allowAny", "filter")
  shouldDisplayFilter(shouldFilter, allowAny, filter) {
    if (shouldFilter) return true;
    if (allowAny && filter.length > 0) return true;
    return false;
  },

  @computed("filter", "filteredComputedContent.[]")
  shouldDisplayNoContentRow(filter, filteredComputedContent) {
    return filter.length > 0 && filteredComputedContent.length === 0;
  },

  @computed("filter", "filterable", "autoFilterable", "renderedFilterOnce")
  shouldFilter(filter, filterable, autoFilterable, renderedFilterOnce) {
    if (renderedFilterOnce && filterable) return true;
    if (filterable) return true;
    if (autoFilterable && filter.length > 0) return true;
    return false;
  },

  @computed("filter", "computedContent")
  shouldDisplayCreateRow(filter, computedContent) {
    if (computedContent.map(c => c.value).includes(filter)) return false;
    if (this.get("allowAny") && filter.length > 0) return true;
    return false;
  },

  @computed("filter", "shouldDisplayCreateRow")
  createRowComputedContent(filter, shouldDisplayCreateRow) {
    if (shouldDisplayCreateRow) {
      let content = this.createContentFromInput(filter);
      return this.computeContentItem(content, { created: true });
    }
  },

  @computed
  templateForRow() { return () => null; },

  @computed
  templateForNoneRow() { return () => null; },

  @computed("filter")
  templateForCreateRow() {
    return (rowComponent) => {
      return I18n.t("select_box.create", {
        content: rowComponent.get("computedContent.name")
      });
    };
  },

  @computed("none")
  noneRowComputedContent(none) {
    if (isNone(none)) { return null; }

    switch (typeof none) {
    case "string":
      return this.computeContentItem(this.noneValue, {
        name: (I18n.t(none) || "").htmlSafe()
      });
    default:
      return this.computeContentItem(none);
    }
  },

  createContentFromInput(input) { return input; },

  willSelect() {
    this.clearFilter();
    this.set("highlightedValue", null);
  },
  didSelect() {
    this.collapse();
    this.focus();

    applyOnSelectPluginApiCallbacks(
      this.get("pluginApiIdentifiers"),
      this.get("computedValue"),
      this
    );

    this._boundaryActionHandler("onSelect", this.get("computedValue"));
  },

  willDeselect() {
    this.clearFilter();
    this.set("highlightedValue", null);
  },
  didDeselect(rowComputedContentItem) {
    this.collapse();
    this.focus();
    this._boundaryActionHandler("onDeselect", rowComputedContentItem);
  },

  clearFilter() {
    this.$filterInput().val("");
    this.setProperties({ filter: "" });
  },

  _setCollectionHeaderComputedContent() {
    const collectionHeaderComputedContent = applyCollectionHeaderCallbacks(
      this.get("pluginApiIdentifiers"),
      this.get("collectionHeader"),
      this
    );
    this.set("collectionHeaderComputedContent", collectionHeaderComputedContent);
  },

  _setHeaderComputedContent() {
    const headerComputedContent = applyHeaderContentPluginApiCallbacks(
      this.get("pluginApiIdentifiers"),
      this.computeHeaderContent(),
      this
    );
    this.set("headerComputedContent", headerComputedContent);
  },

  _boundaryActionHandler(actionName, ...params) {
    if (Ember.get(this.actions, actionName)) {
      run.next(() => this.send(actionName, ...params));
    } else if (this.get(actionName)) {
      run.next(() => this.get(actionName)());
    }
  },

  actions: {
    toggle() {
      this._boundaryActionHandler("onToggle", this);

      if (this.get("isExpanded")) {
        this._boundaryActionHandler("onCollapse", this);
        this.collapse();
      } else {
        this._boundaryActionHandler("onExpand", this);
        this.expand();
      }
    },

    highlight(rowComputedContent) {
      this.set("highlightedValue", rowComputedContent.value);
      this._boundaryActionHandler("onHighlight", rowComputedContent);
    },

    filterComputedContent(filter) {
      this.setProperties({
        highlightedValue: null,
        renderedFilterOnce: true,
        filter
      });
      this.autoHighlight();
      this._boundaryActionHandler("onFilter", filter);
    }
  }
});
