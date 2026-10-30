import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

type B = { x: number; y: number; width: number; height: number };
const overlap = (a: B, b: B) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

async function goOffline(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

for (const width of [320, 390, 1280]) {
  const height = width > 1000 ? 800 : 700;
  test(`Offline-Hinweis überlappt weder Attribution noch Rail-Knöpfe, Text ungekürzt – ${width} px`, async ({ page }) => {
    await openMap(page, { width, height, path: "/?lat=50.94&lng=6.96&z=12" });
    await goOffline(page);
    const note = page.locator("[data-bl-offline-note]");
    await expect(note).toBeVisible();
    const nb = (await note.boundingBox())!;
    const ab = (await page.locator(".leaflet-control-attribution").boundingBox())!;
    expect(overlap(nb, ab), "Offline-Hinweis über Attribution").toBe(false);
    for (const btn of await page.locator("[data-bl-rail] button").all()) {
      const bb = await btn.boundingBox();
      if (bb) expect(overlap(nb, bb), "Offline-Hinweis unter Rail-Knopf").toBe(false);
    }
    const cut = await note.locator("span").evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    expect(cut).toBe(false);
    expect(nb.x + nb.width).toBeLessThanOrEqual(width);
  });

  test(`Offene Suchliste verdeckt die Attribution nicht – ${width} px`, async ({ page }) => {
    await openMap(page, { width, height, path: "/?lat=50.94&lng=6.96&z=12" });
    const inp = page.locator("[data-bl-search] input").first();
    await inp.click();
    await inp.fill("Kö");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    const lb = (await list.boundingBox())!;
    const ab = (await page.locator(".leaflet-control-attribution").boundingBox())!;
    expect(overlap(lb, ab), "Suchliste über Attribution").toBe(false);
  });

  test(`Satelliten-Attribution kompakt, immer sichtbar, ⓘ vollständig erreichbar – ${width} px`, async ({ page }) => {
    await openMap(page, { width, height, path: "/?lat=50.94&lng=6.96&z=12" });
    await page.locator("[data-bl-maptype]").click();
    const attr = page.locator(".leaflet-control-attribution");
    await expect(attr).toContainText("EOxCloudless");
    await expect(attr).toBeVisible();
    if (width < 1024) {
      expect((await attr.boundingBox())!.height).toBeLessThanOrEqual(24);
      await page.locator("[data-bl-attr-toggle]").click();
      expect(await attr.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(attr).toContainText("OpenStreetMap");
    }
  });
}
