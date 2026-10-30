import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

/** Lead 13:30: NL ist nirgends erreichbar – Browsersprache, gespeichertes nl, URL-Param, Sprachwahl Karte/Menü/Footer. */
const NL_WORDS = /Satelliet|Lijst|Zoeken|Bewaard|Toestaan|Niet nu|Voorvertoning|Instellingen/;
async function noNl(page: Page) {
  expect(["de", "en"]).toContain(await page.evaluate(() => document.documentElement.lang));
  const txt = await page.locator("body").innerText();
  expect(txt).not.toMatch(NL_WORDS);
  for (const b of await page.getByRole("button").all()) if (await b.isVisible()) expect((await b.innerText()).trim()).not.toBe("NL");
}
const K1 = "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1";

for (const [name, locale, saved, path] of [
  ["Browser nl-NL, K1", "nl-NL", null, K1],
  ["Browser nl-BE, alte Oberfläche", "nl-BE", null, "/?lat=50.94&lng=6.96&z=11"],
  ["gespeichertes nl, K1", "de-DE", "nl", K1],
  ["URL ?lang=nl, K1", "de-DE", null, K1 + "&lang=nl"],
  ["URL ?lang=nl + Browser nl", "nl-NL", "nl", K1 + "&lang=nl&hl=nl"],
] as const) {
  test.describe(name, () => {
    test.use({ locale });
    test(`${name}: nur DE/EN sichtbar, Menü-Sprachwahl DE/EN`, async ({ page }) => {
      await page.addInitScript((s) => { localStorage.setItem("bl-skip-landing", "1"); sessionStorage.setItem("bl-sat-preview-later", "1"); if (s && !sessionStorage.getItem("seed")) { localStorage.setItem("bl-lang", s); sessionStorage.setItem("seed", "1"); } }, saved);
      await openMap(page, { width: 390, path });
      await noNl(page);
      expect(["de", "en", null]).toContain(await page.evaluate(() => localStorage.getItem("bl-lang")));
      if (path.includes("konzept=1")) {
        await page.locator('[data-k1-tab="mehr"]').click();
        const seg = page.locator('[data-k1-more] [role="group"]').first();
        await expect(seg.locator("button")).toHaveText(["DE", "EN"]);
        await noNl(page);
        for (const l of ["DE", "EN"]) { await seg.getByRole("button", { name: l }).click(); await noNl(page); }
      }
    });
  });
}

for (const path of ["/datenschutz", "/impressum", "/pro?pro=eu", "/datenschutz?lang=nl"]) {
  test.describe(`Rechts-/Pro-Seite ${path}`, () => {
    test.use({ locale: "nl-NL" });
    test(`${path}: Footer nur DE/EN, kein NL`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("bl-lang", "nl"));
      await page.goto(path);
      await noNl(page);
      const g = page.locator("footer [role=group]");
      if (await g.count()) await expect(g.first().locator("button")).toHaveText(["DE", "EN"]);
    });
  });
}
