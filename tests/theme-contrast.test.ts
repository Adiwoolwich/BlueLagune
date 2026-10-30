import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, TOKEN_KEYS, type TokenSet } from "../src/theme/tokens";
import { VARIANTS } from "../src/theme/variants";

type RGBA = [number, number, number, number];
export function parse(c: string): RGBA {
  const h = c.trim();
  if (h.startsWith("#")) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA;
  const m = h.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error("Farbe nicht lesbar: " + c);
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = (c: RGBA) => {
  const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
export const ratio = (a: RGBA, b: RGBA) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** Glas: Fläche über Kartenhintergrund (Worst Case: weiß, schwarz und Variante-bg). */
function glassBgs(t: TokenSet): RGBA[] {
  const g = parse(t["surface-glass"]);
  return [[255, 255, 255, 1], [0, 0, 0, 1], parse(t.bg)].map((b) => over(g, b as RGBA));
}

const all = { default: DEFAULT_THEME, ...VARIANTS };
for (const [name, v] of Object.entries(all)) {
  for (const scheme of ["light", "dark"] as const) {
    const t = v[scheme];
    describe(`Kontrast ${name}/${scheme}`, () => {
      it("alle Token-Schlüssel vorhanden", () => {
        for (const k of TOKEN_KEYS) expect(t[k], k).toBeTruthy();
      });
      const pairs: [string, string][] = [
        ["text", "surface"], ["text-muted", "surface"], ["text", "bg"],
        ["accent-contrast", "accent"], ["cluster-text", "cluster-bg"],
        ["chip-text", "chip-bg"], ["chip-active-text", "chip-active-bg"],
      ];
      for (const [f, b] of pairs)
        it(`${f} auf ${b} ≥ 4,5:1`, () => {
          expect(ratio(parse(t[f as keyof TokenSet]), parse(t[b as keyof TokenSet]))).toBeGreaterThanOrEqual(4.5);
        });
      it("text und text-muted auf Glas ≥ 4,5:1", () => {
        for (const bg of glassBgs(t)) {
          expect(ratio(parse(t.text), bg)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(parse(t["text-muted"]), bg)).toBeGreaterThanOrEqual(4.5);
        }
      });
      it("warmer Akzent auf Glas und auf Kachel ≥ 4,5:1 (nur neue Optik)", () => {
        if (name === "default") return;
        for (const bg of glassBgs(t).slice(1)) expect(ratio(parse(t["accent-warm"]), bg)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(parse(t["accent-warm"]), parse(t["chip-bg"]))).toBeGreaterThanOrEqual(4.5);
      });
      it("Kachel-Akzentstreifen (tile-accent) ≥ 3:1 auf Glas und Fläche", () => {
        expect(ratio(parse(t["tile-accent"]), parse(t.surface))).toBeGreaterThanOrEqual(3);
        for (const bg of glassBgs(t).slice(1)) expect(ratio(parse(t["tile-accent"]), bg)).toBeGreaterThanOrEqual(3);
      });
      it("Fokus und aktiver Marker ≥ 3:1 auf Fläche", () => {
        expect(ratio(parse(t.focus), parse(t.surface))).toBeGreaterThanOrEqual(3);
        expect(ratio(parse(t["marker-active"]), parse(t.bg))).toBeGreaterThanOrEqual(3);
      });
    });
  }
}
