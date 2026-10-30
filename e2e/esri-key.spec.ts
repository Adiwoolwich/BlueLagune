import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

// Satellit liegt hinter der Esri-Einwilligung (Lex, 30.10.): hier vorab erteilt.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes")); });

// Läuft gegen einen Build mit Platzhalter-Key (BL_ESRI_PORT); Esri-Netz wird gemockt, kein echter Key.
const port = process.env.BL_ESRI_PORT;
test.skip(!port, "nur mit BL_ESRI_PORT (Build mit ESRI_API_KEY-Platzhalter)");
test.use({ baseURL: `http://localhost:${port}`, serviceWorkers: "block" });

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

for (const width of [320, 390, 1280]) {
  test(`Esri mit Key: erst nach Einschalten, Attribution sichtbar – ${width} px`, async ({ page, context }) => {
    const esri: string[] = [];
    await context.route(/ibasemaps-api\.arcgis\.com/, (r) => { esri.push(r.request().url()); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
    await openMap(page, { width, height: width > 1000 ? 800 : 760, net: true, path: "/?lat=50.94&lng=6.96&z=12" });
    await page.waitForTimeout(1200);
    expect(esri, "Esri vor dem Einschalten angefragt").toEqual([]);
    await page.locator("[data-bl-maptype]").click();
    await expect.poll(() => esri.length).toBeGreaterThan(0);
    expect(esri[0]).toContain("/World_Imagery/MapServer/tile/");
    expect(esri[0]).toContain("token=");
    const attr = page.locator(".leaflet-control-attribution");
    await expect(attr).toBeVisible();
    for (const s of ["Powered by", "Esri", "Vantor", "Earthstar Geographics", "OpenStreetMap"]) await expect(attr).toContainText(s);
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

test("Esri-Attribution bei 320 px einzeilig, „Powered by Esri“ sichtbar, ⓘ klappt vollständig auf", async ({ page, context }) => {
  await context.route(/arcgis/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await openMap(page, { width: 320, height: 640, net: true, path: "/?lat=50.94&lng=6.96&z=12" });
  await page.locator("[data-bl-maptype]").click();
  const attr = page.locator(".leaflet-control-attribution");
  await expect(attr).toContainText("Powered by");
  const h = (await attr.boundingBox())!.height;
  expect(h).toBeLessThanOrEqual(24);
  const pbVisible = await attr.evaluate((el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const box = el.getBoundingClientRect();
    while ((n = w.nextNode())) { const i = n.textContent!.indexOf("Powered by"); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 10); const b = r.getBoundingClientRect(); return b.right <= box.right && b.left >= box.left; } }
    return false;
  });
  expect(pbVisible).toBe(true);
  const esriLink = attr.getByRole("link", { name: "Esri" }).first();
  const lb = (await esriLink.boundingBox())!; const ab = (await attr.boundingBox())!;
  expect(lb.x + lb.width).toBeLessThanOrEqual(ab.x + ab.width);
  const info = page.locator("[data-bl-attr-toggle]");
  await expect(info).toBeVisible();
  await info.click();
  await expect(attr).toContainText("Esri, Vantor, Earthstar Geographics, and the GIS User Community");
  await expect(attr).not.toContainText("Maxar");
  expect((await attr.boundingBox())!.height).toBeGreaterThan(h);
  const full = await attr.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(full).toBe(true);
});
