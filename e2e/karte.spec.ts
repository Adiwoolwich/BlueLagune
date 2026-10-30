import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

// Satellit liegt hinter der Esri-Einwilligung (Lex, 30.10.): hier vorab erteilt.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes")); });

test.describe("Vektorkarte", () => {
  test("rendert als WebGL-Vektor, scharf mit devicePixelRatio", async ({ browser }) => {
    const ctx = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await openMap(page, { width: 390, net: true, path: "/?lat=52.52&lng=13.40&z=12" });
    const canvas = page.locator('canvas.maplibregl-canvas, [data-bl-vector] canvas, canvas[data-bl-vector]').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const info = await canvas.evaluate((c: HTMLCanvasElement) => ({ ratio: c.width / c.getBoundingClientRect().width, gl: Boolean(c.getContext("webgl2") || c.getContext("webgl")) }));
    expect(info.gl).toBe(true);
    expect(info.ratio).toBeGreaterThanOrEqual(1.9);
    // Keine Satelliten-Rasterkacheln im Standard
    expect(await page.locator('img.leaflet-tile[src*="World_Imagery"]').count()).toBe(0);
    await ctx.close();
  });

  test("Pflicht-Attribution sichtbar (OpenFreeMap/OSM), auch mobil", async ({ page }) => {
    await openMap(page, { width: 390, net: true });
    const attr = page.locator(".leaflet-control-attribution");
    await expect(attr).toBeVisible({ timeout: 15000 });
    await expect(attr).toContainText("OpenStreetMap");
    await expect(attr).toContainText("OpenFreeMap");
  });

  test("keine Konsolenfehler beim Laden", async ({ page }) => {
    const errs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push(String(e)));
    await openMap(page, { width: 1280, height: 800, net: true });
    await page.waitForTimeout(2500);
    // /api/* wird im Test gestubbt; externe Fehler (Kachelnetz) zählen mit.
    expect(errs).toEqual([]);
  });

  test("Fallback ohne WebGL: Rasterkarte statt leerer Fläche, Marker bleiben", async ({ page }) => {
    await openMap(page, { width: 390, noWebGL: true });
    await expect(page.locator("img.leaflet-tile, .leaflet-tile-container img").first()).toBeAttached({ timeout: 10000 });
    expect(await page.locator("canvas.maplibregl-canvas").count()).toBe(0);
    await expect(page.locator(".bl-pin, .bl-cl").first()).toBeVisible();
  });
});

test.describe("Satellit-Umschalter", () => {
  test("Kartentyp-Knopf ≥ 44 px wechselt auf Satellit, lädt Kacheln, Attribution EOX, Wahl bleibt gespeichert", async ({ page }) => {
    await openMap(page, { width: 390, net: true, path: "/?lat=52.52&lng=13.40&z=12" });
    const btn = page.locator("[data-bl-maptype]");
    const box = (await btn.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    const tile = page.waitForResponse((r) => r.url().includes("tiles.maps.eox.at") && r.status() === 200, { timeout: 15000 });
    await btn.click();
    await tile;
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('img.leaflet-tile[src*="s2cloudless"]').first()).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toContainText("EOxCloudless");
    await expect(page.locator(".leaflet-control-attribution")).toContainText("CC BY 4.0");
    await expect(page.locator(".bl-pin, .bl-cl").first()).toBeVisible();
    await page.reload();
    await page.locator(".leaflet-container").waitFor();
    await expect(page.locator("[data-bl-maptype]")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('img.leaflet-tile[src*="s2cloudless"]').first()).toBeAttached({ timeout: 10000 });
    await page.locator("[data-bl-maptype]").click();
    await expect(page.locator("canvas.maplibregl-canvas").first()).toBeVisible({ timeout: 15000 });
  });
});

for (const width of [320, 390, 1280]) {
  for (const mode of ["karte", "satellit"] as const) {
    test(`Attribution sichtbar, nicht verdeckt, mit OSM – ${width} px, ${mode}`, async ({ page }) => {
      await openMap(page, { width, height: width > 1000 ? 800 : 700, net: true, path: "/?lat=52.52&lng=13.40&z=12" });
      if (mode === "satellit") {
        await page.locator("[data-bl-maptype]").click();
        await expect(page.locator(".leaflet-control-attribution")).toContainText("EOxCloudless");
      }
      const attr = page.locator(".leaflet-control-attribution");
      await expect(attr).toBeVisible({ timeout: 15000 });
      await expect(attr).toContainText("OpenStreetMap");
      if (mode === "karte") await expect(attr).toContainText("OpenFreeMap");
      const r = await attr.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const pts = [[b.left + 4, b.top + b.height / 2], [b.left + b.width / 2, b.top + b.height / 2], [b.right - 4, b.top + b.height / 2]];
        const covered = pts.filter(([x, y]) => { const h = document.elementFromPoint(x, y); return !h || !el.contains(h); }).length;
        return { inView: b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth, display: getComputedStyle(el).display, covered };
      });
      expect(r.display).not.toBe("none");
      expect(r.inView).toBe(true);
      expect(r.covered).toBe(0);
    });
  }
}

test("Vektorkarte zeichnet echte Kacheln (Worker lädt, Bild nicht einfarbig)", async ({ page }) => {
  const workerResp: number[] = [];
  page.on("response", (r) => { if (/maplibre-gl-worker.*\.m?js/.test(r.url())) workerResp.push(r.status()); });
  await openMap(page, { width: 1280, height: 800, net: true, path: "/?lat=50.94&lng=6.96&z=11" });
  await page.waitForTimeout(5000);
  expect(workerResp).toContain(200);
  const shot = (await page.screenshot({ clip: { x: 500, y: 420, width: 400, height: 300 } })).toString("base64");
  const colors = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d")!; x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const s = new Set<number>();
    for (let i = 0; i < d.length; i += 16) s.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return s.size;
  }, shot);
  expect(colors).toBeGreaterThan(40);
});
