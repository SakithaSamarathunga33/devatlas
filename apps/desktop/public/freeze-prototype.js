// Prototype-pollution hardening for DevAtlas's own UI. It loads before any app code.
// Tauri's `freezePrototype` setting would also freeze websites shown in the in-app viewer,
// which breaks many of them, so it is disabled in tauri.conf.json in favour of this file.
"use strict";

// Freezing makes inherited built-ins read-only, so ordinary code such as
// `Thing.prototype.constructor = Thing` (d3-color, used by the Bklit charts) would throw: the
// "override mistake". As SES does, these few names become accessors before the freeze: reading
// still returns the original, and assigning on any other object creates that object's own
// property. Object.prototype itself stays frozen and cannot be changed.
for (const name of ["constructor", "toString", "valueOf", "toLocaleString"]) {
  const original = Object.prototype[name];
  Object.defineProperty(Object.prototype, name, {
    get() {
      return original;
    },
    set(value) {
      if (this === Object.prototype) {
        throw new TypeError(`Cannot assign to read only property '${name}' of Object.prototype`);
      }
      Object.defineProperty(this, name, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
    enumerable: false,
    configurable: false,
  });
}

Object.freeze(Object.prototype);
