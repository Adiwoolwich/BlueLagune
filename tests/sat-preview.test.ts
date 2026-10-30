import { describe, expect, it } from "vitest";
import { previewGrid, previewTileUrl, SAT_PREVIEW_ATTRIBUTION } from "../src/lib/sat-preview";

describe("Sat-Vorschau", () => {
  it("2×2-Raster enthält die Station mittig (128…384 px)", () => {
    const g = previewGrid(50.94, 6.96, 17, { mock: true });
    expect(g.tiles).toHaveLength(4);
    expect(g.offX).toBeGreaterThanOrEqual(128);
    expect(g.offX).toBeLessThan(384);
    expect(g.offY).toBeGreaterThanOrEqual(128);
    expect(g.offY).toBeLessThan(384);
  });
  it("Mock lädt nur lokale Platzhalter", () => {
    expect(previewGrid(52.5, 13.4, 17, { mock: true }).tiles.every((t) => t.url?.startsWith("/mock-sat/"))).toBe(true);
  });
  it("Echt ohne Key → null (Vektor-Rückfall), mit Key → Esri-Vorlage", () => {
    expect(previewTileUrl(17, 1, 2, { mock: false, key: "" })).toBeNull();
    const u = previewTileUrl(17, 1, 2, { mock: false, key: "TESTKEY" })!;
    expect(u).toContain("/World_Imagery/MapServer/tile/17/2/1");
    expect(u).toContain("token=TESTKEY");
  });
  it("Attribution", () => expect(SAT_PREVIEW_ATTRIBUTION).toBe("Esri, Maxar, Earthstar Geographics"));
});
