import { on as emberOn } from "@ember/object/evented";
import { observer } from "@ember/object";
import {
  alias as EmberAlias,
  and as EmberAnd,
  bool as EmberBool,
  collect as EmberCollect,
  empty as EmberEmpty,
  equal as EmberEqual,
  filter as EmberFilter,
  filterBy as EmberFilterBy,
  gt as EmberGt,
  gte as EmberGte,
  lt as EmberLt,
  lte as EmberLte,
  map as EmberMap,
  mapBy as EmberMapBy,
  match as EmberMatch,
  max as EmberMax,
  min as EmberMin,
  none as EmberNone,
  not as EmberNot,
  notEmpty as EmberNotEmpty,
  oneWay as EmberOneWay,
  or as EmberOr,
  reads as EmberReads,
  setDiff as EmberSetDiff,
  sort as EmberSort,
  sum as EmberSum,
  union as EmberUnion,
  uniq as EmberUniq,
} from "@ember/object/computed";
import { bind as emberBind, schedule } from "@ember/runloop";
import decoratorAlias from "discourse-common/utils/decorator-alias";
import extractValue from "discourse-common/utils/extract-value";
import handleDescriptor from "discourse-common/utils/handle-descriptor";
import isDescriptor from "discourse-common/utils/is-descriptor";
import macroAlias from "discourse-common/utils/macro-alias";

export default function discourseComputedDecorator(...params) {
  // determine if user called as @discourseComputed('blah', 'blah') or @discourseComputed
  if (isDescriptor(params[params.length - 1])) {
    return handleDescriptor(...arguments);
  } else {
    return function (/* target, key, desc */) {
      return handleDescriptor(...arguments, params);
    };
  }
}

export function afterRender(target, name, descriptor) {
  const originalFunction = descriptor.value;
  descriptor.value = function () {
    schedule("afterRender", () => {
      if (!this.isDestroying && !this.isDestroyed) {
        return originalFunction.apply(this, arguments);
      }
    });
  };
}

export function bind(target, name, descriptor) {
  return {
    configurable: true,
    get() {
      const bound = emberBind(this, descriptor.value);
      const attributes = Object.assign({}, descriptor, {
        value: bound,
      });

      Object.defineProperty(this, name, attributes);

      return bound;
    },
  };
}

export function readOnly(target, name, desc) {
  return {
    writable: false,
    enumerable: desc.enumerable,
    configurable: desc.configurable,
    initializer() {
      let value = extractValue(desc);
      return value.readOnly();
    },
  };
}

export const on = decoratorAlias(emberOn, "Can not `on` without event names");
export const observes = decoratorAlias(
  observer,
  "Can not `observe` without property names"
);

export const alias = macroAlias(EmberAlias);
export const and = macroAlias(EmberAnd);
export const bool = macroAlias(EmberBool);
export const collect = macroAlias(EmberCollect);
export const empty = macroAlias(EmberEmpty);
export const equal = macroAlias(EmberEqual);
export const filter = macroAlias(EmberFilter);
export const filterBy = macroAlias(EmberFilterBy);
export const gt = macroAlias(EmberGt);
export const gte = macroAlias(EmberGte);
export const lt = macroAlias(EmberLt);
export const lte = macroAlias(EmberLte);
export const map = macroAlias(EmberMap);
export const mapBy = macroAlias(EmberMapBy);
export const match = macroAlias(EmberMatch);
export const max = macroAlias(EmberMax);
export const min = macroAlias(EmberMin);
export const none = macroAlias(EmberNone);
export const not = macroAlias(EmberNot);
export const notEmpty = macroAlias(EmberNotEmpty);
export const oneWay = macroAlias(EmberOneWay);
export const or = macroAlias(EmberOr);
export const reads = macroAlias(EmberReads);
export const setDiff = macroAlias(EmberSetDiff);
export const sort = macroAlias(EmberSort);
export const sum = macroAlias(EmberSum);
export const union = macroAlias(EmberUnion);
export const uniq = macroAlias(EmberUniq);
