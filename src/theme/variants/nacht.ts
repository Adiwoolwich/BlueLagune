import { DEFAULT_THEME, type ThemeVariant } from "../tokens";
/** Platzhalter – übernimmt die heutigen Werte. Die echte Variante „nacht“ füllt sie aus. */
export const nacht: ThemeVariant = { name: "nacht", light: { ...DEFAULT_THEME.light }, dark: { ...DEFAULT_THEME.dark } };
