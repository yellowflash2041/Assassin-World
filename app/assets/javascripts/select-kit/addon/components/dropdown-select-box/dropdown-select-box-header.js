import SingleSelectHeaderComponent from "select-kit/components/select-kit/single-select-header";
import { computed } from "@ember/object";
import layout from "select-kit/templates/components/dropdown-select-box/dropdown-select-box-header";
import { readOnly } from "@ember/object/computed";

export default SingleSelectHeaderComponent.extend({
  layout,
  classNames: ["btn-default", "dropdown-select-box-header"],
  tagName: "button",
  classNameBindings: ["btnClassName"],
  showFullTitle: readOnly("selectKit.options.showFullTitle"),
  attributeBindings: ["buttonType:type"],
  buttonType: "button",

  btnClassName: computed("showFullTitle", function () {
    return `btn ${this.showFullTitle ? "btn-icon-text" : "no-text btn-icon"}`;
  }),

  caretUpIcon: readOnly("selectKit.options.caretUpIcon"),

  caretDownIcon: readOnly("selectKit.options.caretDownIcon"),

  caretIcon: computed(
    "selectKit.isExpanded",
    "caretUpIcon",
    "caretDownIcon",
    function () {
      return this.selectKit.isExpanded ? this.caretUpIcon : this.caretDownIcon;
    }
  ),
});
