import { on, observes } from "ember-addons/ember-computed-decorators";
import computed from "ember-addons/ember-computed-decorators";
import { iconHTML } from "discourse-common/lib/icon-library";

export default Ember.Component.extend({
  layoutName: "components/select-box",

  classNames: "select-box",
  classNameBindings: ["expanded:is-expanded"],

  expanded: false,
  focused: false,
  filterFocused: false,
  renderBody: false,
  wrapper: true,
  tabindex: 0,
  scrollableParentSelector: ".modal-body",

  caretUpIcon: "caret-up",
  caretDownIcon: "caret-down",
  headerText: I18n.t("select_box.default_header_text"),
  dynamicHeaderText: true,
  icon: null,
  clearable: false,

  value: null,
  selectedContent: null,
  noContentLabel: I18n.t("select_box.no_content"),
  lastHovered: null,
  clearSelectionLabel: null,

  idKey: "id",
  textKey: "text",
  iconKey: "icon",

  filterable: false,
  filter: "",
  filterPlaceholder: I18n.t("select_box.filter_placeholder"),
  filterIcon: "search",

  selectBoxRowComponent: "select-box/select-box-row",
  selectBoxFilterComponent: "select-box/select-box-filter",
  selectBoxHeaderComponent: "select-box/select-box-header",
  selectBoxCollectionComponent: "select-box/select-box-collection",

  minWidth: 220,
  maxCollectionHeight: 200,
  verticalOffset: 0,
  horizontalOffset: 0,

  castInteger: false,

  filterFunction: function(content) {
    return (selectBox) => {
      const filter = selectBox.get("filter").toLowerCase();
      return _.filter(content, (c) => {
        return c[selectBox.get("textKey")].toLowerCase().indexOf(filter) > -1;
      });
    };
  },

  titleForRow: function() {
    return (rowComponent) => {
      return rowComponent.get(`content.${this.get("textKey")}`);
    };
  }.property(),

  shouldHighlightRow: function() {
    return (rowComponent) => {
      if (Ember.isNone(this.get("value")) && Ember.isNone(this.get("lastHovered"))) {
        return false;
      }

      const id = this._castInteger(rowComponent.get(`content.${this.get("idKey")}`));
      if (Ember.isNone(this.get("lastHovered"))) {
        return id === this.get("value");
      } else {
        return id === this.get("lastHovered");
      }
    };
  }.property(),

  templateForRow: function() {
    return (rowComponent) => {
      let template = "";

      if (rowComponent.get("content.icon")) {
        template += iconHTML(Handlebars.escapeExpression(rowComponent.get("content.icon")));
      }

      const text = rowComponent.get(`content.${this.get("textKey")}`);
      template += `<p class="text">${Handlebars.escapeExpression(text)}</p>`;

      return template;
    };
  }.property(),

  applyDirection() {
    const offsetTop = this.$()[0].getBoundingClientRect().top;
    const windowHeight = $(window).height();
    const headerHeight = this.$(".select-box-header").outerHeight(false);
    const filterHeight = this.$(".select-box-filter").outerHeight(false);

    if (windowHeight - (offsetTop + this.get("maxCollectionHeight") + filterHeight + headerHeight) < 0) {
      this.$().addClass("is-reversed");
      this.$(".select-box-body").css({
        left: this.get("horizontalOffset"),
        top: "auto",
        bottom: headerHeight + this.get("verticalOffset")
      });
    } else {
      this.$().removeClass("is-reversed");
      this.$(".select-box-body").css({
        left: this.get("horizontalOffset"),
        top: headerHeight + this.get("verticalOffset"),
        bottom: "auto"
      });
    }
  },

  init() {
    this._super();

    const content = this.getWithDefault("content", []);
    this.set("content", content);

    if (this.site.isMobileDevice) {
      this.set("filterable", false);
    }

    this.setProperties({
      value: this._castInteger(this.get("value")),
      componentId: this.elementId
    });
  },

  @on("willDestroyElement")
  _removeDocumentListeners: function() {
    $(document).off("click.select-box", "keydown.select-box");
    $(window).off("resize.select-box");
  },

  @on("willDestroyElement")
  _unbindEvents: function() {
    this.$(".select-box-offscreen").off(
      "focusin.select-box",
      "focusout.select-box",
      "keydown.select-box"
    );
    this.$(".filter-query").off("focusin.select-box", "focusout.select-box");
  },

  @on("didRender")
  _configureSelectBoxDOM: function() {
    if (this.get("scrollableParent").length === 1) {
      this._removeFixedPosition();
    }

    this.$().css("min-width", this.get("minWidth"));

    const computedWidth = this.$().outerWidth(false);
    const computedHeight = this.$().outerHeight(false);

    this.$(".select-box-header").css("height", computedHeight);
    this.$(".select-box-filter").css("height", computedHeight);

    if (this.get("expanded")) {
      if (this.get("scrollableParent").length === 1) {
        this._applyFixedPosition(computedWidth, computedHeight);
      }

      this.$(".select-box-body").css("width", computedWidth);
      this.$(".select-box-collection").css("max-height", this.get("maxCollectionHeight"));

      this.applyDirection();

      if (this.get("wrapper")) {
        this._positionSelectBoxWrapper();
      }
    } else {
      if (this.get("wrapper")) {
        this.$(".select-box-wrapper").hide();
      }
    }
  },

  @on("didRender")
  _setupDocumentListeners: function() {
    $(document)
      .on("click.select-box", (event) => {
        if (this.isDestroying || this.isDestroyed) { return; }

        const $element = this.$();
        const $target = $(event.target);

        if (!$target.closest($element).length) {
          this.set("expanded", false);
        }
      })
      .on("keydown.select-box", (event) => {
        const keyCode = event.keyCode || event.which;

        if (this.get("expanded") && keyCode === 9) {
          this.set("expanded", false);
        }
      });

    $(window).on("resize.select-box", () => this.set("expanded", false) );
  },

  @on("didInsertElement")
  _bindEvents: function() {
    this.$(".select-box-offscreen")
      .on("focusin.select-box", () => this.set("focused", true) )
      .on("focusout.select-box", () => this.set("focused", false) );

    this.$(".filter-query")
      .on("focusin.select-box", () => this.set("filterFocused", true) )
      .on("focusout.select-box", () => this.set("filterFocused", false) );

    this.$(".select-box-offscreen").on("keydown.select-box", (event) => {
      const keyCode = event.keyCode || event.which;

      if (keyCode === 13 || keyCode === 40) {
        this.setProperties({expanded: true, focused: false});
        return false;
      }

      if (keyCode === 27) {
        this.$(".select-box-offscreen").blur();
        return false;
      }

      if (keyCode >= 65 && keyCode <= 90) {
        this.setProperties({expanded: true, focused: false});
        Ember.run.schedule("afterRender", () => {
          this.$(".filter-query").focus().val(String.fromCharCode(keyCode));
        });
      }
    });
  },

  @observes("expanded")
  _expandedChanged: function() {
    if (this.get("expanded")) {
      this.setProperties({ focused: false, renderBody: true });

      if (this.get("filterable")) {
        Ember.run.schedule("afterRender", () => this.$(".filter-query").focus());
      }
    };
  },

  @computed("value", "content.[]")
  selectedContent(value, content) {
    if (Ember.isNone(value)) {
      return null;
    }

    return content.find((c) => {
      return this._castInteger(c[this.get("idKey")]) === value;
    });
  },

  @computed("headerText", "dynamicHeaderText", "selectedContent", "textKey", "clearSelectionLabel")
  generatedHeadertext(headerText, dynamic, selectedContent, textKey, clearSelectionLabel) {
    if (dynamic && !Ember.isNone(selectedContent)) {
      return selectedContent[textKey];
    }

    if (dynamic && Ember.isNone(selectedContent) && !Ember.isNone(clearSelectionLabel)) {
      return I18n.t(clearSelectionLabel);
    }

    return headerText;
  },

  @computed("content.[]", "filter")
  filteredContent(content, filter) {
    let filteredContent;

    if (Ember.isEmpty(filter)) {
      filteredContent = content;
    } else {
      filteredContent = this.filterFunction(content)(this);
    }

    return filteredContent;
  },

  @computed("scrollableParentSelector")
  scrollableParent(scrollableParentSelector) {
    return this.$().parents(scrollableParentSelector).first();
  },

  actions: {
    onToggle() {
      this.toggleProperty("expanded");
    },

    onFilterChange(filter) {
      this.set("filter", filter);
    },

    onSelectRow(content) {
      this.setProperties({
        value: this._castInteger(content[this.get("idKey")]),
        expanded: false
      });
    },

    onClearSelection() {
      this.setProperties({ value: null, expanded: false });
    },

    onHoverRow(content) {
      this.set("lastHovered", this._castInteger(content[this.get("idKey")]));
    }
  },

  _positionSelectBoxWrapper() {
    const headerHeight = this.$(".select-box-header").outerHeight(false);

    this.$(".select-box-wrapper").css({
      width: this.$().width(),
      display: "block",
      height: headerHeight + this.$(".select-box-body").outerHeight(false)
    });
  },

  _castInteger(id) {
    if (this.get("castInteger") === true && Ember.isPresent(id)) {
      return parseInt(id, 10);
    }

    return id;
  },

  _applyFixedPosition(width, height) {
    const $placeholder = $(`<div class='select-box-fixed-placeholder-${this.get("componentId")}' style='vertical-align: middle; height: ${height}px; width: ${width}px; line-height: ${height}px;display:inline-block'></div>`);

    this.$()
      .before($placeholder)
      .css({
        width,
        position: "fixed",
        "margin-top": -this.get("scrollableParent").scrollTop(),
        "margin-left": -width
      });

    this.get("scrollableParent").on("scroll.select-box", () => this.set("expanded", false) );
  },

  _removeFixedPosition() {
    $(`.select-box-fixed-placeholder-${this.get("componentId")}`).remove();
    this.$().css({
      top: "auto",
      left: "auto",
      "margin-left": "auto",
      "margin-top": "auto",
      position: "relative"
    });

    this.get("scrollableParent").off("scroll.select-box");
  }
});
