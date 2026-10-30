import { DEFAULT_THEME, tokensToCss } from "./tokens";

/** Rechtsseiten ohne ?design=… haben keine --bl-*-Variablen (applyDesign läuft nur mit Design).
 * Dann die Standard-Tokens (DEFAULT_THEME, hell/dunkel) nur im Bereich .bl-legal-tokens setzen.
 * Mit Design (data-design) gelten die globalen :root-Werte unverändert. shell.css bleibt unberührt. */
export const LEGAL_TOKEN_CSS =
  `:root:not([data-design]) .bl-legal-tokens { ${tokensToCss(DEFAULT_THEME.light)} }\n` +
  `@media (prefers-color-scheme: dark) { :root:not([data-design]) .bl-legal-tokens { ${tokensToCss(DEFAULT_THEME.dark)} } }`;
