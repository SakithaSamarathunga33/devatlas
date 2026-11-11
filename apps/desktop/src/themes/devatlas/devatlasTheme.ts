import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/** Neutral with DevAtlas's teal accent, neutral grays and Geist. */
export const devatlasTheme = defineTheme({
  extends: neutralTheme,
  name: "devatlas",
  color: { accent: ["#0f766e", "#14b8a6"], neutralStyle: "neutral" },
  typography: {
    body: { family: "Geist Variable", fallbacks: "ui-sans-serif, system-ui, sans-serif" },
    heading: { family: "Geist Variable", fallbacks: "ui-sans-serif, system-ui, sans-serif" },
  },
  // The owner's neutral charcoal: no tint from the accent. [light, dark]
  tokens: {
    "--color-background-body": ["#eef2f6", "#0f1115"],
    "--color-background-surface": ["#f8fafc", "#17191e"],
    "--color-background-card": ["#f8fafc", "#17191e"],
    "--color-background-popover": ["#f8fafc", "#1f2228"],
  },
});
