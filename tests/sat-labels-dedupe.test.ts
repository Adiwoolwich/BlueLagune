import { describe, expect, it } from "vitest";
import { SAT_LABEL_STYLE } from "../src/lib/map-label-style";

describe("Satellit-Beschriftung ohne Mehrfach-Labels", () => {
  const sym = SAT_LABEL_STYLE.layers.filter((l) => l.type === "symbol") as Array<{ id: string; layout?: Record<string, unknown>; "source-layer"?: string }>;
  it("keine Layer erzwingen Überlappung", () => {
    for (const l of sym) {
      expect(l.layout?.["text-allow-overlap"], l.id).not.toBe(true);
      expect(l.layout?.["text-ignore-placement"], l.id).not.toBe(true);
    }
  });
  it("Gewässerlinien nur einmal beschriftet (keine Punkt-Platzierung auf waterway)", () => {
    expect(sym.filter((l) => l["source-layer"] === "waterway").map((l) => l.layout?.["symbol-placement"])).toEqual(["line"]);
  });
});
