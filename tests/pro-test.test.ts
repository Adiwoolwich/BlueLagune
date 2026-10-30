import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { PRO_TEST, proActive, pickVariant } from "../src/lib/pro-test";
import { PRO_TEXT, proText } from "../src/lib/pro-texts";
import { readFileSync } from "node:fs";
import { de, en, nl } from "../src/lib/i18n";

describe("Testseite Pro Europa (Fake Door, ohne Zahlung, ohne Daten, ohne Tracking)", () => {
  it("Pflichtformulierungen DE exakt", () => {
    const d = PRO_TEXT.de;
    expect(d.preview).toBe("Vorschau – noch nicht erhältlich, nichts wird berechnet");
    expect(d.price).toBe("9,99 € pro Jahr inkl. MwSt.");
    expect(d.cta).toBe("Interesse zeigen");
    expect(d.thanks).toBe("Danke! Wir zählen nur anonym mit, wie viele Interesse haben – nichts über dich.");
    expect(d.headline.europa).toBe("Entsorgen ohne böse Überraschung – in ganz Europa.");
    expect(d.headline.frankreich).toBe("Frankreichs Aires de services auf deiner Karte");
  });
  it("Nur DE/EN (User 12:42: NL raus), EN vollständig, NL fällt auf EN zurück", () => {
    expect(Object.keys(PRO_TEXT).sort()).toEqual(["de", "en"]);
    expect(Object.keys(PRO_TEXT.en).sort()).toEqual(Object.keys(PRO_TEXT.de).sort());
    expect(proText("nl")).toBe(PRO_TEXT.en);
    expect(proText("de")).toBe(PRO_TEXT.de);
    for (const f of ["src/lib/pro-texts.ts", "src/components/pro-europa.tsx", "src/components/pro-k1.tsx", "src/lib/pro-test.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Voorvertoning|Interesse tonen|Wat slaan|dagtotalen/);
    }
    expect(nl.privacyProP).toBe(en.privacyProP);
    expect(readFileSync("src/components/site-footer.tsx", "utf8")).not.toMatch(/setLang\("nl"\)/);
  });
  it("Variante zufällig pro Aufruf, Override nur per URL, nichts gespeichert", () => {
    expect(pickVariant("?pro=fr")).toBe("frankreich");
    expect(pickVariant("?pro=eu")).toBe("europa");
    const seen = new Set(Array.from({ length: 200 }, () => pickVariant("")));
    expect(seen).toEqual(new Set(["europa", "frankreich"]));
  });
  it("Test hat festes Enddatum und Schalter", () => {
    expect(PRO_TEST.enabled).toBe(true);
    expect(PRO_TEST.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(proActive(new Date("2026-10-30T12:00:00+01:00"))).toBe(true);
    expect(proActive(new Date(PRO_TEST.endDate + "T23:59:59+01:00"))).toBe(true);
    expect(proActive(new Date("2027-01-01T00:00:00+01:00"))).toBe(false);
  });
  it("Lex-QS: Chip mit Vorschau, FAQ „nur anonyme Tagessummen“", () => {
    expect(PRO_TEXT.de.chip).toBe("Pro Europa · Vorschau");
    expect(PRO_TEXT.en.chip).toBe("Pro Europa · Preview");
    expect(PRO_TEXT.de.faq.find(([q]) => q === "Was speichert ihr?")![1]).toBe("Nur anonyme Tagessummen, nichts Persönliches.");
    expect(PRO_TEXT.en.faq.find(([q]) => q === "What do you store?")![1]).toBe("Only anonymous daily totals, nothing personal.");
  });
  it("DSE-Satz Tageszähler: DE wörtlich nach Lex, EN/NL vorhanden, in der Datenschutzseite", () => {
    expect(de.privacyProP).toBe("Anonyme Tageszähler (Test „Pro Europa“): Wenn dir der Hinweis „Pro Europa“ angezeigt wird, du auf „Interesse zeigen“ tippst oder welche Variante (Europa/Frankreich) du siehst, erhöht unser Server (Cloudflare Workers) einen Zähler für den jeweiligen Tag. Wir speichern dabei keine IP-Adresse, keinen Hash, keine Kennung und keine Cookies und lesen nichts aus deinem Gerätespeicher; deine IP-Adresse wird technisch bedingt nur kurz für die Übertragung verarbeitet. Es entstehen nur Summen pro Tag, die keinen Bezug zu dir haben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, herauszufinden, ob genug Nachfrage für Pro Europa besteht). Der Test endet am 27.11.2026.");
    expect(en.privacyProP).toContain("27.11.2026".replace(/(\d+)\.(\d+)\.(\d+)/, "$1/$2/$3"));
    expect(readFileSync("src/components/legal-pages.tsx", "utf8")).toContain('t("privacyProP")');
  });
  it("Produktname überall „Pro Europa“, auch EN – kein „Pro Europe“", () => {
    for (const f of ["src/lib/i18n.ts", "src/lib/pro-texts.ts", "src/components/pro-europa.tsx", "src/components/pro-k1.tsx", "index.html"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/Pro Europe\b/);
    }
    expect(PRO_TEXT.en.honest).toContain("Pro Europa");
    expect(en.privacyProP).toContain("Pro Europa");
  });
  it("Metric-Pfad: keine IP, kein Hash, kein Logging, feste Ereignisliste", () => {
    const m = readFileSync("worker/metrics.ts", "utf8");
    expect(m).not.toMatch(/console\.|CF-Connecting-IP|sha256|salt\(|hash\(/i);
    expect(m).toMatch(/METRIC_EVENTS = new Set\(\["pro_chip_seen", "pro_interest"\]\)/);
    const w = readFileSync("worker.ts", "utf8");
    const block = w.slice(w.indexOf('"/api/metric"'), w.indexOf('"/admin/pro"'));
    expect(block).not.toMatch(/console\.|CF-Connecting-IP|countVisit|hash/i);
    const pm = readFileSync("src/lib/pro-metric.ts", "utf8");
    expect(pm).not.toMatch(/localStorage|sessionStorage|document\.cookie|navigator\.(userAgent|language)/);
  });
  it("keine Speicherung, kein Netz, keine Zahlung in den Pro-Dateien", () => {
    const hits = execSync("grep -nE 'localStorage|sessionStorage|document\\.cookie|fetch\\(|sendBeacon|XMLHttpRequest|stripe|paypal|<input|<form' src/lib/pro-test.ts src/lib/pro-texts.ts src/components/pro-europa.tsx src/components/pro-k1.tsx || true", { encoding: "utf8" }).trim();
    expect(hits).toBe("");
  });
});
