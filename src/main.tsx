import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Inter (SIL OFL 1.1, selbst gehostet via @fontsource/inter, kein CDN)
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "./styles.css";
import { App } from "./App";
import { bootLang } from "./lib/i18n";

bootLang();

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
