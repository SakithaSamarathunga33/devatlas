// First: the stylesheet declares the cascade layers every later import depends on.
import "@/styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";

const container = document.getElementById("root");
if (!container) {
  throw new Error("DevAtlas could not start: #root is missing from index.html.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
