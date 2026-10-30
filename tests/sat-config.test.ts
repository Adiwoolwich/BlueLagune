import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SAT_SOURCES, satSource, satTileUrl } from "../src/lib/sat-source";

describe("Satellit austauschbar, Klarheit-Geste entfernt", () => {
  it("kein satClarity-Zustand mehr", () => {
    expect(execSync("grep -rn 'satClarity\\|SatClarity\\|mapClarity' src || true", { encoding: "utf8" }).trim()).toBe("");
  });
  it("eine Konfigurationsstelle: Standard EOX 2016, Attribution mit OSM, maxNativeZoom", () => {
    const s = satSource();
    expect(s.id).toBe("eox-s2-2016");
    expect(s.attribution).toContain("EOxCloudless");
    expect(s.attribution).toContain("OpenStreetMap");
    expect(s.maxNativeZoom).toBe(15);
    expect(satTileUrl(s)).toContain("tiles.maps.eox.at");
  });
  it("Key-Platzhalter wird aus Variable ersetzt, ohne Key bleibt Quelle ohne Key nutzbar", () => {
    const keyed = { ...SAT_SOURCES["eox-s2-2016"], url: "https://x/{z}/{x}/{y}.jpg?key={key}", needsKey: true };
    expect(satTileUrl(keyed, "abc")).toBe("https://x/{z}/{x}/{y}.jpg?key=abc");
    expect(satTileUrl(keyed, undefined)).toBeNull();
  });
  it("station-map enthält keine fest verdrahtete Satelliten-URL", () => {
    expect(readFileSync("src/components/station-map.tsx", "utf8")).not.toMatch(/tiles\.maps\.eox\.at/);
  });
});
