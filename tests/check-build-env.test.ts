import { describe, expect, it } from "vitest";
// @ts-expect-error JS-Modul ohne Typen
import { checkBuildEnv } from "../scripts/check-build-env.mjs";

const KEY = "geheim-test-123";
describe("Prebuild-Sperre", () => {
  it("ohne Key → Abbruch", () => {
    const r = checkBuildEnv({ VITE_SAT_MOCK: "0" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ESRI_API_KEY fehlt");
  });
  it("leerer Key → Abbruch", () => expect(checkBuildEnv({ ESRI_API_KEY: "  ", VITE_SAT_MOCK: "0" }).ok).toBe(false));
  it("Mock nicht 0 → Abbruch", () => {
    expect(checkBuildEnv({ ESRI_API_KEY: KEY }).ok).toBe(false);
    expect(checkBuildEnv({ ESRI_API_KEY: KEY, VITE_SAT_MOCK: "1" }).ok).toBe(false);
  });
  it("Key + VITE_SAT_MOCK=0 → ok", () => expect(checkBuildEnv({ ESRI_API_KEY: KEY, VITE_SAT_MOCK: "0" })).toMatchObject({ ok: true, level: "ok" }));
  it("Override → ok mit Warnung", () => expect(checkBuildEnv({ BL_ALLOW_MOCK_BUILD: "1" })).toMatchObject({ ok: true, level: "warn" }));
  it("Override nur mit genau 1", () => expect(checkBuildEnv({ BL_ALLOW_MOCK_BUILD: "true" }).ok).toBe(false));
  it("Key nie in der Meldung", () => {
    for (const env of [{ ESRI_API_KEY: KEY }, { ESRI_API_KEY: KEY, VITE_SAT_MOCK: "0" }, { ESRI_API_KEY: KEY, BL_ALLOW_MOCK_BUILD: "1" }]) {
      expect(checkBuildEnv(env).message).not.toContain(KEY);
    }
  });
});
