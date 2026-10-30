import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

// Screens Konzept 1 Ausbau (nur mit K1_OUT), de-DE, Mock-Satellit mit Einwilligung.
test.use({ locale: "de-DE" });
const OUT = process.env.K1_OUT;
const PATH = "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1";

async function open(page: Page, w: number) {
  await page.addInitScript(() => {
    localStorage.setItem("bl-skip-landing", "1");
    localStorage.setItem("bl-sat-preview", "yes");
    localStorage.setItem("bl-recent-q", JSON.stringify(["Köln", "Leverkusen"]));
  });
  await openMap(page, { width: w, height: w >= 1024 ? 800 : 844, path: PATH });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
  await page.waitForTimeout(1200);
}

for (const w of [390, 1280]) {
  test(`Screens ${w}`, async ({ page }) => {
    test.skip(!OUT, "nur mit K1_OUT");
    await open(page, w);
    await page.screenshot({ path: `${OUT}/konzept1-karte-${w}.png` });
    if (w === 1280) await page.screenshot({ path: `${OUT}/konzept1-desktop-${w}.png` });
    await page.locator("[data-k1-open-search]").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/konzept1-suche-${w}.png` });
    await page.locator('[data-k1-search] [aria-label="Schließen"]').click();
    await page.locator('[data-k1-tab="mehr"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/konzept1-menue-${w}.png` });
    await page.locator('[data-k1-tab="karte"]').click();
    if (w === 1280) await page.locator("[data-bl-list]").getByText("Köln", { exact: false }).first().click();
    else await page.locator("[data-card]").first().click();
    await expect(page.locator("[data-bl-detail]")).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/konzept1-station-${w}.png` });
  });
}
