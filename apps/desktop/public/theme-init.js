// Applies the saved theme before the app renders, so a light-theme user never sees a dark flash
// of the page. Kept as a file because the CSP allows no inline scripts. Dark is the default.
"use strict";
try {
  if (localStorage.getItem("devatlas-theme") === "light") {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
  }
} catch {
  // Storage can be unavailable; the default dark theme applies.
}
