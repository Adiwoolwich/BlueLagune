import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

test.use({ locale: "de-DE" });

// Alte Oberfläche (ohne ?design): Satellitenglobus hinter derselben Einwilligung.
test("Alte Oberfläche: kein Esri-/Mock-Request vor „Erlauben“, auch bei gespeichertem Satellit", async ({ page }) => {
  const reqs: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/mock-sat/") || /arcgis|esri/i.test(u)) reqs.push(u);
  });
  await page.addInitScript(() => {
    localStorage.setItem("bl-skip-landing", "1");
  });
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11" });
  await expect(page.locator(".bl-g-pill")).toHaveCount(0);
  const btn = page.locator("[data-bl-maptype]");
  await btn.click();
  await expect(page.locator("[data-bl-sat-ask]")).toBeVisible();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(800);
  expect(reqs).toEqual([]);
  await page.locator("[data-bl-sat-later]").click();
  await expect(page.locator("[data-bl-sat-ask]")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(reqs).toEqual([]);
  await btn.click();
  await expect(page.locator("[data-bl-sat-ask]")).toBeVisible();
  await page.locator("[data-bl-sat-allow]").click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("bl-sat-preview"))).toBe("yes");
});

test("Alte Oberfläche: gespeicherter mapStyle=sat lädt ohne Einwilligung nichts", async ({ page }) => {
  const reqs: string[] = [];
  page.on("request", (r) => { const u = r.url(); if (u.includes("/mock-sat/") || /arcgis|esri/i.test(u)) reqs.push(u); });
  await page.addInitScript(() => {
    localStorage.setItem("bl-skip-landing", "1");
    localStorage.setItem("blue-lagoon-v4", JSON.stringify({ state: { mapStyle: "sat", mapLabels: true }, version: 0 }));
  });
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11" });
  await page.waitForTimeout(1200);
  expect(reqs).toEqual([]);
  await expect(page.locator("[data-bl-maptype]")).toHaveAttribute("aria-pressed", "false");
});
