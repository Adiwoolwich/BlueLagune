import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

test("keine Anfragen an Esri/ArcGIS – Karte, Satellit und offline", async ({ page, context }) => {
  const bad: string[] = [];
  context.on("request", (r) => { if (/arcgis|esri/i.test(r.url())) bad.push(r.url()); });
  await openMap(page, { width: 390, height: 844, net: true, path: "/?lat=50.94&lng=6.96&z=12" });
  await page.waitForTimeout(1500);
  await page.locator("[data-bl-maptype]").click();
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(1500);
  await expect(page.locator(".leaflet-control-attribution")).not.toContainText(/Esri/i);
  expect(bad).toEqual([]);
});

for (const width of [320, 390]) {
  test(`Radius-Feld voll lesbar und ≥ 44 px bei ${width} px`, async ({ page }) => {
    await openMap(page, { width, height: 760, path: "/?lat=50.94&lng=6.96&z=11&place=K%C3%B6ln" });
    const sel = page.locator('select[aria-label]').first();
    await expect(sel).toBeVisible();
    for (const v of ["200", "20", "0"]) {
      await sel.evaluate((el: HTMLSelectElement, val) => { el.value = val; }, v);
      const r = await sel.evaluate((el: HTMLSelectElement) => {
        const cs = getComputedStyle(el);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = el.options[el.selectedIndex]?.text ?? "";
        const need = ctx.measureText(text).width;
        const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const b = el.getBoundingClientRect();
        return { text, need, avail, w: b.width, h: b.height, right: b.right, vw: innerWidth };
      });
      expect(r.need, `"${r.text}" passt nicht (${r.need.toFixed(1)} > ${r.avail})`).toBeLessThanOrEqual(r.avail);
      expect(r.h).toBeGreaterThanOrEqual(44);
      expect(r.w).toBeGreaterThanOrEqual(44);
      expect(r.right).toBeLessThanOrEqual(r.vw);
    }
  });
}

test("Platzhalter im Suchfeld bei 320 px voll sichtbar", async ({ page }) => {
  await openMap(page, { width: 320, height: 640 });
  const inp = page.locator("[data-bl-search] input").first();
  const r = await inp.evaluate((el: HTMLInputElement) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return { ph: el.placeholder, need: ctx.measureText(el.placeholder).width, avail: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) };
  });
  expect(r.ph.length).toBeGreaterThan(0);
  expect(r.need, `Platzhalter "${r.ph}" abgeschnitten`).toBeLessThanOrEqual(r.avail);
});
