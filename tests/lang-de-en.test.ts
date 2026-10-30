import { describe, expect, it } from "vitest";
import { ACTIVE_LANGS, nl, pickLang } from "../src/lib/i18n";

describe("Sprache nur DE/EN (nl → en)", () => {
  it("gespeichertes nl wird en", () => expect(pickLang("nl", "de-DE")).toBe("en"));
  it("Browsersprache nl-NL/nl-BE wird en", () => {
    expect(pickLang(null, "nl-NL")).toBe("en");
    expect(pickLang(null, "nl-BE")).toBe("en");
  });
  it("de/en bleiben, Standard de", () => {
    expect(pickLang("de", "nl-NL")).toBe("de");
    expect(pickLang("en", "de-DE")).toBe("en");
    expect(pickLang(null, "en-GB")).toBe("en");
    expect(pickLang(null, "fr-FR")).toBe("de");
    expect(pickLang("xx", "")).toBe("de");
  });
  it("aktive Sprachen nur de/en; NL-Einträge bleiben im Code", () => {
    expect([...ACTIVE_LANGS]).toEqual(["de", "en"]);
    expect(Object.keys(nl).length).toBeGreaterThan(100);
  });
});
