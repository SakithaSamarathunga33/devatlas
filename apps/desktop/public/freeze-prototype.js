// Prototype-pollution hardening for DevAtlas's own UI. It loads before any app code.
// Tauri's `freezePrototype` setting would also freeze websites shown in the in-app viewer,
// which breaks many of them, so it is disabled in tauri.conf.json in favour of this file.
"use strict";
Object.freeze(Object.prototype);
