import { DEFAULT_THEME, type ThemeVariant } from "../tokens";
/** Platzhalter – übernimmt die heutigen Werte. Die echte Variante „teal“ füllt sie aus. */
export const teal: ThemeVariant = { name: "teal", light: { ...DEFAULT_THEME.light }, dark: { ...DEFAULT_THEME.dark } };
