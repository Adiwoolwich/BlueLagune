import { describe, expect, it } from "vitest";
import { STATUS_COLOR, MARKER_BG } from "../src/components/status-badge";

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const L = (rgb: number[]) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a: string, b: string) => { const x = L(hex(a)), y = L(hex(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function isRed(h: string) {
  const [r, g, b] = hex(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 60 || mx !== r) return false;
  const hue = (60 * ((g - b) / (mx - mn)) + 360) % 360;
  return hue < 20 || hue > 340;
}

describe("Marker-Farben", () => {
  it("Rot nur bei defekt", () => {
    for (const [k, v] of Object.entries(STATUS_COLOR)) expect(isRed(v), k).toBe(k === "broken");
  });
  it("Marker ≥ 3:1 gegen Kartengrund in beiden Themes, weißes Icon ≥ 3:1 auf Marker", () => {
    for (const bg of [MARKER_BG.light, MARKER_BG.dark])
      for (const [k, v] of Object.entries(STATUS_COLOR)) {
        // Ring (weiß bzw. dunkel) trennt Marker von Karte; Fläche selbst muss sich vom Ring abheben.
        expect(Math.max(ratio(v, bg), ratio(v, "#ffffff")), k).toBeGreaterThanOrEqual(3);
      }
    for (const [k, v] of Object.entries(STATUS_COLOR)) expect(ratio(v, "#ffffff"), k).toBeGreaterThanOrEqual(3);
  });
});
