/**
 * Theme-Tokens der Karten-Oberfläche. Jede Designvariante liefert dieselben Schlüssel;
 * sie werden als CSS-Variablen mit Präfix --bl- auf :root geschrieben (siehe theme.css,
 * dort werden die --bl-* auf die Tailwind-Farben --color-* abgebildet).
 * Ohne ?design=… bleibt die heutige Optik (Default unten = heutige Hell-/Dunkelwerte).
 */
export const TOKEN_KEYS = [
  "bg", "surface", "surface-glass", "text", "text-muted", "accent", "accent-contrast",
  "marker", "marker-active", "cluster-bg", "cluster-text", "chip-bg", "chip-text",
  "chip-active-bg", "chip-active-text", "border", "focus",
  "radius-sm", "radius-md", "radius-lg", "radius-sheet",
  "shadow-1", "shadow-2", "blur",
  "family-ui", "family-num",
  "dur-fast", "dur-ui", "dur-fly", "easing",
  "map-style",
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type TokenSet = Record<TokenKey, string>;
export type ThemeVariant = { name: string; light: TokenSet; dark: TokenSet };

/** Gemeinsame, nicht farbabhängige Tokens. Dauern: UI < 250 ms, Fly/Sheet ≤ 600 ms. */
export const BASE_SHAPE = {
  "radius-sm": "6px",
  "radius-md": "10px",
  "radius-lg": "16px",
  "radius-sheet": "10px",
  blur: "15px",
  "family-ui": 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "family-num": 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "dur-fast": "150ms",
  "dur-ui": "220ms",
  "dur-fly": "600ms",
  easing: "cubic-bezier(.2, .8, .2, 1)",
} satisfies Partial<TokenSet>;

/** OpenFreeMap-Stile (frei, kein Kostenanbieter). Aktuell genutzt wird der eigene Vektorstil aus map-base-style.ts. */
export const MAP_STYLE = {
  light: "openfreemap:positron",
  dark: "openfreemap:dark",
};

/** Heutige Optik (cd6bb73) als Token-Satz. */
export const DEFAULT_THEME: ThemeVariant = {
  name: "default",
  light: {
    ...BASE_SHAPE,
    bg: "#efefef", surface: "#ffffff", "surface-glass": "rgb(255 255 255 / 0.92)",
    text: "#171a20", "text-muted": "#5c5e62", accent: "#3e6ae1", "accent-contrast": "#ffffff",
    marker: "#0b7d86", "marker-active": "#3e6ae1", "cluster-bg": "#ffffff", "cluster-text": "#171a20",
    "chip-bg": "#f4f4f4", "chip-text": "#171a20", "chip-active-bg": "#3e6ae1", "chip-active-text": "#ffffff",
    border: "#c9cacc", focus: "#3e6ae1",
    "shadow-1": "0 5px 10px rgb(0 0 0 / 0.075)", "shadow-2": "0 8px 16px rgb(0 0 0 / 0.16)",
    "map-style": MAP_STYLE.light,
  },
  dark: {
    ...BASE_SHAPE,
    bg: "#262626", surface: "#171717", "surface-glass": "rgb(23 23 23 / 0.92)",
    text: "#f4f4f5", "text-muted": "#a8a8b0", accent: "#2b66db", "accent-contrast": "#ffffff",
    marker: "#0b7d86", "marker-active": "#6b9bff", "cluster-bg": "#171717", "cluster-text": "#f4f4f5",
    "chip-bg": "#222222", "chip-text": "#f4f4f5", "chip-active-bg": "#2b66db", "chip-active-text": "#ffffff",
    border: "#44444a", focus: "#6b9bff",
    "shadow-1": "0 2px 8px rgb(0 0 0 / 0.4)", "shadow-2": "0 12px 40px rgb(0 0 0 / 0.55)",
    "map-style": MAP_STYLE.dark,
  },
};

export function tokensToCss(t: TokenSet): string {
  return TOKEN_KEYS.map((k) => `--bl-${k}: ${t[k]};`).join(" ");
}

export type DesignName = "nacht" | "sand" | "teal";
export const DESIGNS: DesignName[] = ["nacht", "sand", "teal"];

export function designFromUrl(search: string): DesignName | null {
  const v = new URLSearchParams(search).get("design");
  return v && (DESIGNS as string[]).includes(v) ? (v as DesignName) : null;
}

/** Schreibt die Tokens der Variante als <style> und setzt data-design auf <html>. */
export function applyDesign(variant: ThemeVariant, doc: Document = document): void {
  const css = `:root[data-design="${variant.name}"] { ${tokensToCss(variant.light)} }
@media (prefers-color-scheme: dark) { :root[data-design="${variant.name}"] { ${tokensToCss(variant.dark)} } }`;
  let el = doc.getElementById("bl-theme-tokens") as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = "bl-theme-tokens";
    doc.head.appendChild(el);
  }
  el.textContent = css;
  doc.documentElement.dataset.design = variant.name;
}
