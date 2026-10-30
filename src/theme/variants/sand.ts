import { DEFAULT_THEME, type ThemeVariant } from "../tokens";
/** Platzhalter – übernimmt die heutigen Werte. Die echte Variante „sand“ füllt sie aus. */
export const sand: ThemeVariant = { name: "sand", light: { ...DEFAULT_THEME.light }, dark: { ...DEFAULT_THEME.dark } };
