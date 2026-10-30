import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { de, en, nl } from "../src/lib/i18n";

describe("Lex-Änderungen zu 2a81769", () => {
  it("privacyProP DE: Klartext/dauerhafte Kennung, Label Tageszähler", () => {
    expect(de.privacyProP.startsWith("Tageszähler (Test „Pro Europa“)")).toBe(true);
    expect(de.privacyProP).toContain("keine IP-Adresse im Klartext und keine dauerhafte Kennung");
    expect(de.privacyProP).not.toMatch(/Anonyme|keine IP-Adresse, keine Kennung/);
  });
  it("privacyProP EN: plain text/permanent identifier, Daily counters", () => {
    expect(en.privacyProP.startsWith("Daily counters (")).toBe(true);
    expect(en.privacyProP).toContain("We do not store your IP address in plain text or any permanent identifier");
    expect(en.privacyProP).not.toMatch(/Anonymous|an IP address, identifier/);
  });
  it("NL-Texte entfernt, nl = en", () => {
    expect(nl).toEqual(en);
    const src = readFileSync("src/lib/i18n.ts", "utf8");
    expect(src).not.toMatch(/nlOwn|Plaatszoeken|Rechtsgrondslagen/);
  });
});
