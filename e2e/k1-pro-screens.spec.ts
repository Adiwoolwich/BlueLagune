import { test } from "@playwright/test";
import { dragMap, openK1 } from "./pro-k1-helpers";

/** Screens de-DE für Lead (nur mit K1PRO_OUT). */
const OUT = process.env.K1PRO_OUT;
test.use({ locale: "de-DE" });
test.skip(!OUT, "nur mit K1PRO_OUT");

for (const width of [390, 1280]) {
  test(`Screens ${width}`, async ({ page }) => {
    await openK1(page, { width });
    await dragMap(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/karte-chip-${width}.png` });
    await page.locator("[data-k1-pro-chip]").click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/pro-tab-${width}.png` });
  });
}
test("Datenschutz Satellitenvorschau 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes"));
  await page.goto("/datenschutz#satellitenvorschau");
  await page.locator("#satellitenvorschau").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/datenschutz-sat-390.png` });
});
