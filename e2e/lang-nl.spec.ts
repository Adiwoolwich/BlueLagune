import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

test.describe("Locale nl-NL → Englisch (ganze App)", () => {
  test.use({ locale: "nl-NL" });
  test("alte Oberfläche ohne ?design: Browsersprache nl → en", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
    await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11" });
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  });
  test("gespeichertes nl → en, Konzept 1 zeigt nur DE/EN", async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("bl-skip-landing", "1"); if (!sessionStorage.getItem("s")) { localStorage.setItem("bl-lang", "nl"); sessionStorage.setItem("s", "1"); } });
    await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1" });
    expect(await page.evaluate(() => [document.documentElement.lang, localStorage.getItem("bl-lang")])).toEqual(["en", "en"]);
    await page.locator('[data-k1-tab="mehr"]').click();
    await expect(page.locator('[data-k1-more] [aria-label="Language"] button, [data-k1-more] [aria-label="Sprache"] button')).toHaveText(["DE", "EN"]);
  });
  test("Rechtsseite: Footer nur DE/EN, Text Englisch", async ({ page }) => {
    await page.goto("/datenschutz");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("footer [role=group]").first().locator("button")).toHaveText(["DE", "EN"]);
  });
});
