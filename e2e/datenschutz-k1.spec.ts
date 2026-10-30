import { expect, test } from "@playwright/test";

test.use({ locale: "de-DE" });

test("Datenschutz: Kapitel Satellitenvorschau mit Status und Widerruf (bl-sat-preview + -later)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) { localStorage.setItem("bl-sat-preview", "yes"); localStorage.setItem("bl-sat-preview-ok", "1"); sessionStorage.setItem("bl-sat-preview-later", "1"); sessionStorage.setItem("seeded", "1"); }
  });
  await page.goto("/datenschutz");
  const sec = page.locator("#satellitenvorschau");
  await expect(sec.getByRole("heading", { level: 2 })).toHaveText("Satellitenvorschau");
  await expect(sec).toContainText("Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG).");
  await expect(sec.locator("[data-bl-sat-status]")).toContainText("erteilt");
  const btn = sec.getByRole("button", { name: "Einwilligung widerrufen" });
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.click();
  await expect(sec.locator("[data-bl-sat-status]")).toContainText("nicht erteilt");
  await expect(sec.locator("[role=status]")).toContainText("widerrufen");
  await expect(btn).toBeDisabled();
  expect(await page.evaluate(() => [localStorage.getItem("bl-sat-preview"), sessionStorage.getItem("bl-sat-preview-later"), localStorage.getItem("bl-sat-preview-ok")])).toEqual([null, null, "1"]);
  // nur einmal im Dokument
  await expect(page.getByText("Satellitenvorschau und -karte (Esri ArcGIS)")).toHaveCount(1);
  await expect(page.locator("body")).toContainText("Sie bleiben nur auf deinem Gerät und werden nicht an uns übertragen.");
  await expect(page.locator("body")).toContainText("Anonyme Tageszähler (Test „Pro Europa“)");
  await expect(page.locator("[data-bl-privacy-visit]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Datenschutz EN: Satellite preview chapter", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bl-lang", "en"));
  await page.goto("/datenschutz?lang=en");
  const sec = page.locator("#satellitenvorschau");
  await expect(sec.getByRole("heading", { level: 2 })).toHaveText("Satellite preview");
  await expect(sec.getByRole("button", { name: "Withdraw consent" })).toBeVisible();
});
