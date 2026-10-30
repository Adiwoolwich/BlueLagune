import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Inter (SIL OFL 1.1, selbst gehostet via @fontsource/inter, kein CDN)
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "./styles.css";
import "./theme/theme.css";
import "./theme/design.css";
import { applyDesign, designFromUrl } from "./theme/tokens";
import { VARIANTS } from "./theme/variants";
import { App } from "./App";
import { bootLang } from "./lib/i18n";

bootLang();

// Designvariante per ?design=nacht|sand|teal; ohne Parameter bleibt die heutige Optik.
const design = designFromUrl(window.location.search);
if (design) applyDesign(VARIANTS[design]);

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
