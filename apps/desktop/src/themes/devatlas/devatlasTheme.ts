import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/**
 * "Indigo Aurora": the accent comes from the DevAtlas mark's indigo-to-blue gradient, over cool
 * near-black neutrals in dark mode and Apple's light gray in light mode. Softer, larger radii
 * and a crisp motion character give it an Apple-like feel. Keep the installer's copy in sync.
 */
export const devatlasTheme = defineTheme({
  extends: neutralTheme,
  name: "devatlas",
  // [light, dark]: Apple's system indigo. White labels on it pass AA (5.6:1 and 5.1:1).
  color: { accent: ["#5856d6", "#5e5ce6"], neutralStyle: "cool" },
  typography: {
    body: { family: "Geist Variable", fallbacks: "ui-sans-serif, system-ui, sans-serif" },
    heading: { family: "Geist Variable", fallbacks: "ui-sans-serif, system-ui, sans-serif" },
  },
  radius: { base: 4, multiplier: 1.5 },
  motion: { character: "crisp" },
  tokens: {
    "--color-background-body": ["#f5f5f7", "#0b0b10"],
    "--color-background-surface": ["#ffffff", "#15151c"],
    "--color-background-card": ["#ffffff", "#15151c"],
    "--color-background-popover": ["#ffffff", "#1c1c24"],
    "--color-border": ["#e5e5ea", "#26262f"],
    // Pinned so buttons stay white-on-indigo; the generator would pick a pale dark-mode accent.
    "--color-accent": ["#5856d6", "#5e5ce6"],
    "--color-on-accent": ["#ffffff", "#ffffff"],
    // Links and accent icons need a lighter indigo on near-black (8.5:1 on the card surface).
    "--color-text-accent": ["#5856d6", "#a9a8ff"],
    "--color-icon-accent": ["#5856d6", "#a9a8ff"],
  },
  // Materials: a still aurora (`--aurora`, in globals.css) lights the window frame, and the title
  // bar and sidebar are transparent over it, so content reads as one raised surface.
  components: {
    "app-shell": { base: { backgroundImage: "var(--aurora, none)" } },
    "app-shell-header": { base: { backgroundColor: "transparent" } },
    "app-shell-sidenav": { base: { backgroundColor: "transparent" } },
    // The current page is tinted with the accent, as macOS sidebars do.
    "side-nav-item": {
      selected: { backgroundColor: "var(--color-accent-muted)", color: "var(--color-text-accent)" },
    },
  },
});
