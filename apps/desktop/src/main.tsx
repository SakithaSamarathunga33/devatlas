import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";

import "@/styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("DevAtlas could not start: #root is missing from index.html.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
