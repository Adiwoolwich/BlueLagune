import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SAT_SOURCES, satSource, satTileUrl } from "../src/lib/sat-source";
import { planDownload } from "../src/lib/offline-tiles";
import { de, en, nl } from "../src/lib/i18n";

describe("Satellit: eine Konfigurationsstelle, Esri mit Key, EOX als Rückfall", () => {
  it("kein satClarity-Zustand mehr", () => {
    expect(execSync("grep -rn 'satClarity\\|SatClarity\\|mapClarity' src || true", { encoding: "utf8" }).trim()).toBe("");
  });
  it("ohne ESRI_API_KEY: EOX 2016 (Rückfall)", () => {
    const s = satSource("");
    expect(s.id).toBe("eox-s2-2016");
    expect(s.attribution).toContain("EOxCloudless");
    expect(s.attribution).toContain("OpenStreetMap");
    expect(s.maxNativeZoom).toBe(15);
    expect(satTileUrl(s, "")).toContain("tiles.maps.eox.at");
  });
  it("mit Key: Esri World Imagery über Static Basemap Tiles, Token in URL, 512er-Kacheln", () => {
    const s = satSource("TESTKEY");
    expect(s.id).toBe("esri-imagery");
    const url = satTileUrl(s, "TESTKEY")!;
    expect(url).toMatch(/^https:\/\/static-map-tiles-api\.arcgis\.com\/arcgis\/rest\/services\/static-basemap-tiles-service\/v1\/arcgis\/imagery\/static\/tile\/\{z\}\/\{y\}\/\{x\}\?token=TESTKEY$/);
    expect(s.tileSize).toBe(512);
    expect(s.zoomOffset).toBe(-1);
  });
  it("Esri-Attribution: Powered by Esri, Bildquellen Maxar/Earthstar, OSM", () => {
    const a = SAT_SOURCES["esri-imagery"].attribution;
    expect(a).toContain("Powered by");
    expect(a).toContain("Esri");
    expect(a).toContain("Maxar");
    expect(a).toContain("Earthstar Geographics");
    expect(a).toContain("OpenStreetMap");
  });
  it("Quelle mit Pflicht-Key ohne Key liefert keine URL", () => {
    expect(satTileUrl(SAT_SOURCES["esri-imagery"], "")).toBeNull();
  });
  it("Esri nur in der Konfigurationsstelle, nicht in Service Worker oder Offline-Download", () => {
    const hits = execSync("grep -rliE 'arcgis' src public || true", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    expect(hits.sort()).toEqual(["public/sw.js", "src/lib/i18n.ts", "src/lib/sat-source.ts"]);
    // i18n nur der Link trust.arcgis.com im Datenschutz-Baustein
    expect(readFileSync("src/lib/i18n.ts", "utf8").split("\n").filter((l) => /arcgis/i.test(l)).every((l) => /privacySatP/.test(l))).toBe(true);
    const sw = readFileSync("public/sw.js", "utf8");
    // im SW nur als Ausschluss: NO_CACHE_HOSTS, nie in TILE_HOSTS
    expect(sw.split("\n").filter((l) => /arcgis/.test(l)).every((l) => /NO_CACHE_HOSTS/.test(l))).toBe(true);
    expect(sw).toMatch(/NO_CACHE_HOSTS\.some\([^\n]*\) return;/);
    const { urls } = planDownload({ west: 6.9, east: 7.0, south: 50.9, north: 50.95 }, 12);
    expect(urls.some((u) => /arcgis|esri|eox/i.test(u))).toBe(false);
  });
  it("station-map enthält keine fest verdrahtete Satelliten-URL", () => {
    expect(readFileSync("src/components/station-map.tsx", "utf8")).not.toMatch(/tiles\.maps\.eox\.at|arcgis/);
  });
  it("Datenschutz-Baustein Satellit: Lex' Du-Fassung, ohne DPF-Satz, mit SCC – DE/EN/NL", () => {
    expect(de.privacySatP).toContain("Wenn du die Satellitenansicht einschaltest, lädt dein Browser Kartenkacheln direkt von Servern der Environmental Systems Research Institute, Inc. (Esri), 380 New York Street, Redlands, CA 92373, USA.");
    expect(de.privacySatP).toContain("Esri Data Processing Addendum");
    expect(de.privacySatP).toContain("Am einfachsten lässt du die Satellitenansicht ausgeschaltet.");
    expect(de.privacySatP).not.toMatch(/\b(Sie|Ihr|Ihre|Ihren|Ihrem)\b/);
    expect(nl.privacySatP).not.toMatch(/\b(u|uw)\b/);
    for (const l of [de, en, nl]) {
      expect(l.privacySatP).not.toMatch(/Data Privacy Framework|DPF|Art\. 45/);
      expect(l.privacySatP).toMatch(/Art\. 46/);
      expect(l.privacySatP).toMatch(/Standardvertragsklauseln|Standard Contractual Clauses|standaardcontractbepalingen/);
      expect(l.privacySatP).not.toContain("[");
    }
  });

});
