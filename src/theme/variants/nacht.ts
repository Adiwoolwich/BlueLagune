import { DESIGN_DARK, DESIGN_MAP_PALETTE, type ThemeVariant } from "../tokens";
/** Platzhalter auf Basis der neuen Optik (Graphit/Nachtblau). Die echte Variante „nacht“ überschreibt Tokens und Palette. */
export const nacht: ThemeVariant = {
  name: "nacht",
  forceDark: true,
  light: { ...DESIGN_DARK },
  dark: { ...DESIGN_DARK },
  mapPalette: { ...DESIGN_MAP_PALETTE },
  loadFonts: () => Promise.all([import("@fontsource/barlow-condensed/latin-600.css"), import("@fontsource/barlow-condensed/latin-700.css")]),
};
