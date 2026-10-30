import type { Pal } from "../lib/map-base-style";

/**
 * Theme-Tokens der Karten-Oberfläche. Jede Designvariante liefert dieselben Schlüssel;
 * sie werden als CSS-Variablen mit Präfix --bl- auf :root geschrieben (siehe theme.css,
 * dort werden die --bl-* auf die Tailwind-Farben --color-* abgebildet).
 * Ohne ?design=… bleibt die heutige Optik (Default unten = heutige Hell-/Dunkelwerte).
 */
export const TOKEN_KEYS = [
  "bg", "surface", "surface-glass", "text", "text-muted", "accent", "accent-contrast",
  "marker", "marker-active", "cluster-bg", "cluster-text", "chip-bg", "chip-text",
  "chip-active-bg", "chip-active-text", "border", "focus", "accent-warm", "glow", "glow-active", "map-labels",
  "radius-sm", "radius-md", "radius-lg", "radius-sheet",
  "shadow-1", "shadow-2", "blur",
  "family-ui", "family-num", "family-display",
  "dur-fast", "dur-ui", "dur-fly", "easing",
  "map-style",
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type TokenSet = Record<TokenKey, string>;
export type ThemeVariant = {
  name: string;
  light: TokenSet;
  dark: TokenSet;
  /** Variante immer dunkel (Karte + Oberfläche), unabhängig von prefers-color-scheme. */
  forceDark?: boolean;
  /** Eigene Kartenpalette für baseStyle(scheme, pal) aus map-base-style.ts. */
  mapPalette?: Pal;
  /** lädt selbst gehostete Schriften nur für diese Variante */
  loadFonts?: () => Promise<unknown>;
};

/** Gemeinsame, nicht farbabhängige Tokens. Dauern: UI < 250 ms, Fly/Sheet ≤ 600 ms. */
export const BASE_SHAPE = {
  "radius-sm": "6px",
  "radius-md": "10px",
  "radius-lg": "16px",
  "radius-sheet": "10px",
  blur: "15px",
  "family-ui": 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "family-num": 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  "family-display": '"Barlow Condensed", Inter, system-ui, sans-serif',
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
    border: "#c9cacc", focus: "#3e6ae1", "accent-warm": "#a14a07", glow: "rgb(62 106 225 / 0.35)", "glow-active": "rgb(62 106 225 / 0.5)", "map-labels": "full",
    "shadow-1": "0 5px 10px rgb(0 0 0 / 0.075)", "shadow-2": "0 8px 16px rgb(0 0 0 / 0.16)",
    "map-style": MAP_STYLE.light,
  },
  dark: {
    ...BASE_SHAPE,
    bg: "#262626", surface: "#171717", "surface-glass": "rgb(23 23 23 / 0.92)",
    text: "#f4f4f5", "text-muted": "#a8a8b0", accent: "#2b66db", "accent-contrast": "#ffffff",
    marker: "#0b7d86", "marker-active": "#6b9bff", "cluster-bg": "#171717", "cluster-text": "#f4f4f5",
    "chip-bg": "#222222", "chip-text": "#f4f4f5", "chip-active-bg": "#2b66db", "chip-active-text": "#ffffff",
    border: "#44444a", focus: "#6b9bff", "accent-warm": "#f5a524", glow: "rgb(107 155 255 / 0.35)", "glow-active": "rgb(107 155 255 / 0.5)", "map-labels": "full",
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

/**
 * Gemeinsamer Ausgangspunkt der neuen Optik (Graphit/Nachtblau, dunkel, Glas). nacht/sand/teal leiten davon ab.
 * Kontrast ≥ 4,5:1 auch auf Glas (tests/theme-contrast.test.ts).
 */
export const DESIGN_DARK: TokenSet = {
  ...BASE_SHAPE,
  "radius-md": "14px",
  "radius-lg": "20px",
  "radius-sheet": "22px",
  blur: "22px",
  "dur-ui": "240ms",
  "dur-fly": "600ms",
  easing: "cubic-bezier(.2, .9, .25, 1)",
  "family-display": '"Barlow Condensed", Inter, system-ui, sans-serif',
  bg: "#11151b",
  surface: "#171c24",
  "surface-glass": "rgb(20 25 33 / 0.86)",
  text: "#eef2f6",
  "text-muted": "#b4bdc9",
  accent: "#5aa9ff",
  "accent-contrast": "#06182b",
  marker: "#5aa9ff",
  "marker-active": "#7cc0ff",
  "cluster-bg": "#1d3554",
  "cluster-text": "#eef2f6",
  "chip-bg": "#202733",
  "chip-text": "#eef2f6",
  "chip-active-bg": "#5aa9ff",
  "chip-active-text": "#06182b",
  border: "#2e3846",
  focus: "#7cc0ff",
  "accent-warm": "#ffb547",
  glow: "rgb(90 169 255 / 0.45)",
  "glow-active": "rgb(124 192 255 / 0.65)",
  "map-labels": "reduced",
  "shadow-1": "0 6px 18px rgb(0 0 0 / 0.45)",
  "shadow-2": "0 18px 48px rgb(0 0 0 / 0.6)",
  "map-style": MAP_STYLE.dark,
};

/** Kartenpalette Graphit/Nachtblau: gedämpfte Straßen, Wasser in Akzentnähe, wenig Kontrastrauschen. */
export const DESIGN_MAP_PALETTE: Pal = {
  bg: "#14181e", wood: "#171d1f", park: "#171e1e", water: "#0f2a44", waterLine: "#16395a", building: "#1b2028",
  road: "#232a33", roadCase: "#14181e", major: "#2c3540", majorCase: "#161b21", motorway: "#3a4553", motorwayCase: "#1a2028",
  rail: "#252c35", boundary: "#3d4a5a", ink: "#c3ccd6", inkMuted: "#7f8b99", halo: "rgba(10,13,17,0.9)", waterInk: "#5f8fbf",
};

let current: ThemeVariant | null = null;
/** Aktive Designvariante (null = heutige Optik). */
export function currentDesign(): ThemeVariant | null {
  return current;
}

/** Schreibt die Tokens der Variante als <style> und setzt data-design auf <html>. */
export function applyDesign(variant: ThemeVariant, doc: Document = document): void {
  current = variant;
  const css = variant.forceDark
    ? `:root[data-design="${variant.name}"] { color-scheme: dark; ${tokensToCss(variant.dark)} }`
    : `:root[data-design="${variant.name}"] { ${tokensToCss(variant.light)} }
@media (prefers-color-scheme: dark) { :root[data-design="${variant.name}"] { ${tokensToCss(variant.dark)} } }`;
  let el = doc.getElementById("bl-theme-tokens") as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = "bl-theme-tokens";
    doc.head.appendChild(el);
  }
  el.textContent = css;
  doc.documentElement.dataset.design = variant.name;
  void variant.loadFonts?.().catch(() => undefined);
}
