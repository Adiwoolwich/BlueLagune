import { describe, expect, it } from "vitest";
import { previewGrid, previewTileUrl, SAT_PREVIEW_ATTRIBUTION, SAT_PREVIEW_POWERED } from "../src/lib/sat-preview";

describe("Sat-Vorschau", () => {
  it("2×2-Raster enthält die Station mittig (128…384 px)", () => {
    const g = previewGrid(50.94, 6.96, 17, { mock: true });
    expect(g.tiles).toHaveLength(4);
    for (const v of [g.offX, g.offY]) {
      expect(v).toBeGreaterThanOrEqual(128);
      expect(v).toBeLessThan(384);
    }
  });
  it("Mock lädt nur lokale Platzhalter", () => {
    expect(previewGrid(52.5, 13.4, 17, { mock: true }).tiles.every((t) => t.url?.startsWith("/mock-sat/"))).toBe(true);
  });
  it("Echt ohne Key → null (Vektor-Rückfall), mit Key → Esri-Vorlage aus sat-source", () => {
    expect(previewTileUrl(17, 1, 2, { mock: false, key: "" })).toBeNull();
    const u = previewTileUrl(17, 1, 2, { mock: false, key: "TESTKEY" })!;
    expect(u).toContain("/World_Imagery/MapServer/tile/17/2/1");
    expect(u).toContain("token=TESTKEY");
  });
  it("Attribution", () => {
    expect(SAT_PREVIEW_POWERED).toBe("Powered by Esri");
    expect(SAT_PREVIEW_ATTRIBUTION).toBe("Esri, Maxar, Earthstar Geographics");
  });
});

import { allowSat, askSat, loadSatConsent, notNowSat, revokeSat, satAllowed, satAskVisible, SAT_ASK, SAT_CONSENT_KEY, SAT_LATER_KEY } from "../src/lib/sat-preview";
function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), m };
}
describe("Einwilligung Sat-Vorschau", () => {
  const local = fakeStorage();
  const session = fakeStorage();
  (globalThis as Record<string, unknown>).localStorage = local;
  (globalThis as Record<string, unknown>).sessionStorage = session;
  const reset = () => (local.clear(), session.clear(), loadSatConsent());

  it("vor dem Ja: nichts erlaubt, Abfrage sichtbar", () => {
    reset();
    expect(satAllowed()).toBe(false);
    expect(satAskVisible()).toBe(true);
  });
  it("Nicht jetzt: bleibt Miniatur, Sperre nur in sessionStorage, Platzhalter-Klick fragt erneut", () => {
    reset();
    notNowSat();
    expect(satAllowed()).toBe(false);
    expect(satAskVisible()).toBe(false);
    expect(session.m.get(SAT_LATER_KEY)).toBe("1");
    expect(local.m.has(SAT_CONSENT_KEY)).toBe(false);
    session.clear();
    loadSatConsent(); // nächste Sitzung
    expect(satAskVisible()).toBe(true);
    notNowSat();
    askSat();
    expect(satAskVisible()).toBe(true);
  });
  it("Erlauben → localStorage; Gate führt die wartende Aktion (Satellit-Ebene) aus", () => {
    reset();
    let ran = 0;
    askSat(() => ran++);
    expect(ran).toBe(0);
    allowSat();
    expect(ran).toBe(1);
    expect(local.m.get(SAT_CONSENT_KEY)).toBe("yes");
    loadSatConsent();
    expect(satAllowed()).toBe(true);
  });
  it("Widerruf: danach nicht mehr erlaubt, Wahl aus localStorage entfernt", () => {
    reset();
    allowSat();
    revokeSat();
    expect(satAllowed()).toBe(false);
    expect(local.m.has(SAT_CONSENT_KEY)).toBe(false);
  });
  it("Texte nur DE/EN, gleichwertige Knöpfe [Erlauben]/[Nicht jetzt]", () => {
    expect(Object.keys(SAT_ASK.q)).toEqual(["de", "en"]);
    expect(SAT_ASK.allow.de).toBe("Erlauben");
    expect(SAT_ASK.notNow.de).toBe("Nicht jetzt");
    expect(SAT_ASK.body.de).toContain("„Datenschutz“ → „Satellitenvorschau“");
  });
});
