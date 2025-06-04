import { id, addonType } from "../../config.caw.js";
import AddonTypeMap from "../../template/addonTypeMap.js";
import UILayout from "./ui_layout.js";

export default function (parentClass) {
  return class extends parentClass {
    constructor() {
      super();
      this.layout = new UILayout(this.runtime);
      const properties = this._getInitProperties();
      if (properties) {
      }
      this._tryRegisterBehavior();
    }

    _tick2() {
      this._processAll();
    }

    _registerBehavior(behavior) {
      this.behavior = behavior;
      this.behavior.controller = this;
      if (globalThis.__flexbox_controller) {
        globalThis.__flexbox_controller = undefined;
      }
      if (globalThis.__flexbox_behavior) {
        globalThis.__flexbox_behavior = undefined;
      }
      this._setTicking2(true);
    }

    _tryRegisterBehavior() {
      if (globalThis.__flexbox_behavior) {
        this._registerBehavior(globalThis.__flexbox_behavior);
      } else {
        globalThis.__flexbox_controller = this;
      }
    }

    _processAll() {
      for (const instance of this.behavior.getAllInstances()) {
        if (!instance.getParent()) this.layout.processInstance(instance);
      }
    }

    _trigger(method) {
      this.dispatch(method);
      super._trigger(self.C3[AddonTypeMap[addonType]][id].Cnds[method]);
    }

    _invalidateClassComputedStyle(className) {
      for (const instance of this.behavior.getAllInstances()) {
        const classes = instance.__flexbox_ui_element.classes;
        if (classes && classes.includes(className)) {
          instance.__flexbox_ui_element._computedStyles = undefined;
        }
      }
    }

    setClassStyle(className, styleString) {
      this.layout.registerClass(className, styleString);
      this._invalidateClassComputedStyle(className);
    }

    setClassProperty(className, property, value) {
      this.layout.setPropertyInStyle(
        this.layout.getClassStyle(className),
        property,
        value
      );
      this._invalidateClassComputedStyle(className);
    }

    removeClassProperty(className, property) {
      this.layout.removePropertyFromStyle(
        this.layout.getClassStyle(className),
        property
      );
      this._invalidateClassComputedStyle(className);
    }

    on(tag, callback, options) {
      if (!this.events[tag]) {
        this.events[tag] = [];
      }
      this.events[tag].push({ callback, options });
    }

    off(tag, callback) {
      if (this.events[tag]) {
        this.events[tag] = this.events[tag].filter(
          (event) => event.callback !== callback
        );
      }
    }

    dispatch(tag) {
      if (this.events[tag]) {
        this.events[tag].forEach((event) => {
          if (event.options && event.options.params) {
            const fn = self.C3[AddonTypeMap[addonType]][id].Cnds[tag];
            if (fn && !fn.call(this, ...event.options.params)) {
              return;
            }
          }
          event.callback();
          if (event.options && event.options.once) {
            this.off(tag, event.callback);
          }
        });
      }
    }

    _release() {
      super._release();
    }

    _saveToJson() {
      return {
        // data to be saved for savegames
      };
    }

    _loadFromJson(o) {
      // load state for savegames
    }
  };
}
