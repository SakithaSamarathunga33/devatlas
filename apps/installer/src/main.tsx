// First: the stylesheet declares the cascade layers every later import depends on.
import "@/styles.css";

import { Theme } from "@astryxdesign/core/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { defaultThemeSlug, themes } from "@/astryx-themes";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing the #root element.");

createRoot(root).render(
  <StrictMode>
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <App />
    </Theme>
  </StrictMode>,
);
