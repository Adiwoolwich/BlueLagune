import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

// Läuft gegen einen Build mit Platzhalter-Key (BL_ESRI_PORT); Esri-Netz wird gemockt, kein echter Key.
const port = process.env.BL_ESRI_PORT;
test.skip(!port, "nur mit BL_ESRI_PORT (Build mit ESRI_API_KEY-Platzhalter)");
test.use({ baseURL: `http://127.0.0.1:${port}`, serviceWorkers: "block" });

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

for (const width of [320, 390, 1280]) {
  test(`Esri mit Key: erst nach Einschalten, Attribution sichtbar – ${width} px`, async ({ page, context }) => {
    const esri: string[] = [];
    await context.route(/static-map-tiles-api\.arcgis\.com/, (r) => { esri.push(r.request().url()); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
    await openMap(page, { width, height: width > 1000 ? 800 : 760, net: true, path: "/?lat=50.94&lng=6.96&z=12" });
    await page.waitForTimeout(1200);
    expect(esri, "Esri vor dem Einschalten angefragt").toEqual([]);
    await page.locator("[data-bl-maptype]").click();
    await expect.poll(() => esri.length).toBeGreaterThan(0);
    expect(esri[0]).toContain("/arcgis/imagery/static/tile/");
    expect(esri[0]).toContain("token=");
    const attr = page.locator(".leaflet-control-attribution");
    await expect(attr).toBeVisible();
    for (const s of ["Powered by", "Esri", "Maxar", "Earthstar Geographics", "OpenStreetMap"]) await expect(attr).toContainText(s);
    const covered = await attr.evaluate((el) => { const b = el.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !h || !el.contains(h) || b.bottom > innerHeight || b.right > innerWidth; });
    expect(covered).toBe(false);
  });
}

test("Esri mit Key: ohne WebGL-Rückfall wird nicht Esri geladen (nur nach Nutzerwahl)", async ({ page, context }) => {
  const esri: string[] = [];
  await context.route(/arcgis/, (r) => { esri.push(r.request().url()); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  await openMap(page, { width: 390, height: 760, net: true, noWebGL: true, path: "/?lat=50.94&lng=6.96&z=12" });
  await page.waitForTimeout(1500);
  expect(esri).toEqual([]);
});
