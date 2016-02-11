import { WidgetClickHook, WidgetClickOutsideHook } from 'discourse/widgets/click-hook';
import { h } from 'virtual-dom';

function emptyContent() { }

const _registry = {};
const _dirty = {};

export function keyDirty(key) {
  _dirty[key] = true;
}

function drawWidget(builder, attrs, state) {
  const properties = {};

  if (this.buildClasses) {
    let classes = this.buildClasses(attrs, state) || [];
    if (!Array.isArray(classes)) { classes = [classes]; }
    if (classes.length) {
      properties.className = classes.join(' ');
    }
  }
  if (this.buildId) {
    properties.id = this.buildId(attrs);
  }

  if (this.buildAttributes) {
    properties.attributes = this.buildAttributes(attrs);
  }
  if (this.clickOutside) {
    properties['widget-click-outside'] = new WidgetClickOutsideHook(this);
  }
  if (this.click) {
    properties['widget-click'] = new WidgetClickHook(this);
  }

  const attributes = properties['attributes'] || {};
  properties.attributes = attributes;
  if (this.title) {
    attributes.title = I18n.t(this.title);
  }

  return h(this.tagName || 'div', properties, this.html(attrs, state));
}

export function createWidget(name, opts) {
  const result = class CustomWidget extends Widget {};

  if (name) {
    _registry[name] = result;
  }

  opts.html = opts.html || emptyContent;
  opts.draw = drawWidget;

  Object.keys(opts).forEach(k => result.prototype[k] = opts[k]);
  return result;
}

export default class Widget {
  constructor(attrs, container, opts) {
    opts = opts || {};
    this.attrs = attrs || {};
    this.mergeState = opts.state;
    this.container = container;
    this.model = opts.model;

    this.key = this.buildKey ? this.buildKey(attrs) : null;

    this.site = container.lookup('site:main');
    this.siteSettings = container.lookup('site-settings:main');
    this.currentUser = container.lookup('current-user:main');
    this.store = container.lookup('store:main');
  }

  defaultState() {
    return {};
  }

  destroy() {
    console.log('destroy called');
  }

  render(prev) {
    if (prev && prev.state) {
      this.state = prev.state;
    } else {
      this.state = this.defaultState();
    }

    // Sometimes we pass state down from the parent
    if (this.mergeState) {
      this.state = _.merge(this.state, this.mergeState);
    }

    if (prev && prev.shadowTree) {
      this.shadowTree = true;
      if (!_dirty[prev.key]) { return prev.vnode; }
    }

    return this.draw(h, this.attrs, this.state);
  }

  _findAncestorWithProperty(property) {
    let widget = this;
    while (widget) {
      const value = widget[property];
      if (value) {
        return widget;
      }
      widget = widget.parentWidget;
    }
  }

  _findView() {
    const widget = this._findAncestorWithProperty('_emberView');
    if (widget) {
      return widget._emberView;
    }
  }

  attach(widgetName, attrs, opts) {
    let WidgetClass = _registry[widgetName];

    if (!WidgetClass) {
      if (!this.container) {
        console.error("couldn't find container");
        return;
      }
      WidgetClass = this.container.lookupFactory(`widget:${widgetName}`);
    }

    if (WidgetClass) {
      const result = new WidgetClass(attrs, this.container, opts);
      result.parentWidget = this;
      return result;
    } else {
      throw `Couldn't find ${widgetName} factory`;
    }
  }

  scheduleRerender() {
    let widget = this;
    while (widget) {
      if (widget.shadowTree) {
        keyDirty(widget.key);
      }

      const emberView = widget._emberView;
      if (emberView) {
        return emberView.queueRerender();
      }
      widget = widget.parentWidget;
    }
  }

  sendComponentAction(name, param) {
    const view = this._findAncestorWithProperty('_emberView');

    let promise;
    if (view) {
      // Peek into ember internals to allow us to return promises from actions
      const ev = view._emberView;
      const target = ev.get('targetObject');

      const actionName = ev.get(name);
      if (!actionName) {
        Ember.warn(`${name} not found`);
        return;
      }

      if (target) {
        const actions = target._actions || target.actionHooks;
        const method = actions[actionName];
        if (method) {
          promise = method.call(target, param);
          if (!promise || !promise.then) {
            promise = Ember.RSVP.resolve(promise);
          }
        } else {
          return ev.sendAction(name, param);
        }
      }
    }

    if (promise) {
      return promise.then(() => this.scheduleRerender());
    }
  }

  findAncestorModel() {
    const modelWidget = this._findAncestorWithProperty('model');
    if (modelWidget) {
      return modelWidget.model;
    }
  }

  sendWidgetAction(name, param) {
    const widget = this._findAncestorWithProperty(name);
    if (widget) {
      const result = widget[name](param);
      if (result && result.then) {
        return result.then(() => this.scheduleRerender());
      } else {
        this.scheduleRerender();
        return result;
      }
    }

    return this.sendComponentAction(name, param || this.findAncestorModel());
  }
}

Widget.prototype.type = 'Thunk';
