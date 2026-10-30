import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { plural, setLang, t } from "../src/lib/i18n";
import { baseAttribution, localizeAttribution } from "../src/lib/map-base-style";
import { SAT_SOURCES } from "../src/lib/sat-source";

const ESRI_CHAIN = "Esri, Vantor, Earthstar Geographics, and the GIS User Community";
afterEach(() => setLang("de"));

describe("Punkt 3: Singular bei 1 (DE/EN)", () => {
  it("plural() nach Intl-Regeln", () => {
    expect(plural(1, "1 Station", "{n} Stationen", "de")).toBe("1 Station");
    expect(plural(2, "1 Station", "{n} Stationen", "de")).toBe("2 Stationen");
    expect(plural(0, "1 station", "{n} stations", "en")).toBe("0 stations");
  });
  it("t(): alle Zähltexte mit n = 1 im Singular", () => {
    setLang("de");
    expect(t("stationsN", { n: 1 })).toBe("1 Station");
    expect(t("clusterN", { n: 1 })).toBe("1 Station");
    expect(t("stationsN", { n: 3 })).toBe("3 Stationen");
    expect(t("offlineHave", { n: 1 })).toBe("1 Kachel gespeichert");
    expect(t("offlineSaved", { n: 1, mb: 0.1 })).toBe("Fertig. 1 Kachel · ca. 0.1 MB.");
    expect(t("placesFooter", { n: "1" })).toContain("1 Ort ·");
    expect(t("landingCount", { n: 1 })).toBe("Aktuell 1+ Station");
    setLang("en");
    expect(t("stationsN", { n: 1 })).toBe("1 station");
    expect(t("clusterN", { n: 1 })).toBe("1 station");
    expect(t("landingVisitors", { n: "1" })).toBe("1 visitor");
    expect(t("landingVisitors", { n: "1,234" })).toBe("1,234 visitors");
    expect(t("offlineHave", { n: 1 })).toBe("1 tile stored");
    expect(t("noCityHits", { n: 1 })).toContain("in 1 place.");
  });
  it("Shell-Texte haben Singular-Varianten (kein „Alle 1 Stationen“, „1 Stationen zeigen“)", () => {
    const k1 = readFileSync("src/components/shell/konzept1.tsx", "utf8");
    expect(k1).toMatch(/deOne: "1 Station zeigen", enOne: "Show 1 station"/);
    const ds = readFileSync("src/components/shell/design-shell.tsx", "utf8");
    expect(ds).toMatch(/all_one: \{ de: "1 Station", en: "1 station"/);
  });
});

describe("Punkt 2: Kartenattribution über i18n", () => {
  it("DE „Daten ©“, EN „Data ©“, Quellnamen unverändert", () => {
    setLang("de");
    expect(baseAttribution()).toContain("Daten ©");
    setLang("en");
    const en = baseAttribution();
    expect(en).toContain("Data ©");
    expect(en).not.toContain("Daten");
    for (const n of ["OpenFreeMap", "OpenMapTiles", "OpenStreetMap"]) expect(en).toContain(n);
  });
  it("Esri-Kette und Lizenznamen bleiben wörtlich, nur Beiwörter übersetzt", () => {
    setLang("en");
    const esri = localizeAttribution(SAT_SOURCES["esri-imagery"].attribution);
    expect(esri).toContain(ESRI_CHAIN);
    expect(esri).toContain("Powered by");
    expect(esri).toContain("· Names <a");
    expect(esri).not.toMatch(/Namen|Satellit/);
    const eox = localizeAttribution(SAT_SOURCES["eox-s2-2016"].attribution);
    expect(eox.startsWith("Satellite:")).toBe(true);
    expect(eox).toContain("CC BY 4.0");
    expect(eox).toContain("Contains modified Copernicus Sentinel data 2016");
    setLang("de");
    expect(localizeAttribution(SAT_SOURCES["esri-imagery"].attribution)).toBe(SAT_SOURCES["esri-imagery"].attribution);
  });
});

describe("Punkt 1/4: Quelltext-Checks", () => {
  it("Tippziele: Footer-Links/Buttons min-h-11 min-w-11, „Nur diesmal“ min-h-11, K1-Chips min 44 px", () => {
    expect(readFileSync("src/components/site-footer.tsx", "utf8")).toMatch(/min-h-11 min-w-11/);
    expect(readFileSync("src/App.tsx", "utf8")).toMatch(/min-h-11[^"]*" data-bl-landing-once/);
    expect(readFileSync("src/theme/k1-tap.css", "utf8")).toMatch(/min-height: 44px; min-width: 44px/);
  });
  it("Desktop-Liste: Vorschau nur bei Einwilligung", () => {
    const src = readFileSync("src/components/station-panel.tsx", "utf8");
    expect(src).toMatch(/const satThumb = satAllowed && k1Desktop/);
    expect(src).toMatch(/\{satThumb \? \(/);
  });
});

describe("Esri-Quellenzeile Desktop-Liste (Lex 30.10.)", () => {
  it("Präfix DE/EN über i18n", () => {
    setLang("de");
    expect(t("satImagery")).toBe("Satellitenbilder:");
    setLang("en");
    expect(t("satImagery")).toBe("Satellite imagery:");
  });
  it("Zeile: Esri-Link, Fallback-Kette wörtlich, © je Bild; CSS sticky, ≥ 12 px, Link ≥ 44 px", () => {
    const src = readFileSync("src/components/sat-preview.tsx", "utf8");
    expect(src).toMatch(/<a href="https:\/\/www\.esri\.com" target="_blank" rel="noopener"[^>]*>Esri<\/a>/);
    expect(src).toMatch(/data-bl-sat-credit>© Esri</);
    expect(readFileSync("src/components/station-panel.tsx", "utf8")).toMatch(/height=\{64\} credit/);
    const css = readFileSync("src/theme/k1-tap.css", "utf8");
    expect(css).toMatch(/\.bl-sat-attr-line \{ position: sticky; bottom: 0;[^}]*font-size: 12px/);
    expect(css).toMatch(/\.bl-sat-attr-link \{[^}]*min-height: 44px; min-width: 44px/);
    expect(readFileSync("src/lib/sat-preview.ts", "utf8")).toContain("Esri, Vantor, Earthstar Geographics, and the GIS User Community");
  });
});
