import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

// Nacharbeit Cringe-Urteil ff5ffea (K1): Tippziele, EN-Attribution, Singular, Desktop-Satvorschau.
test.use({ locale: "de-DE", serviceWorkers: "block" });
const K1 = "design=teal&konzept=1";
const ONE = `/?lat=53.5418&lng=10.0194&z=16&${K1}`; // genau eine Station (hh-hafen) im Ausschnitt
const KOELN = `/?lat=50.94&lng=6.96&z=11&${K1}`;
const SHOTS = process.env.BL_SHOTS; // Zielordner für Screens (optional)

async function open(page: Page, width: number, path = KOELN) {
  await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await openMap(page, { width, height: width >= 1024 ? 800 : 844, path });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
}
async function hit(page: Page, sel: string) {
  const els = await page.locator(sel).all();
  expect(els.length, sel).toBeGreaterThan(0);
  for (const e of els) {
    const b = (await e.boundingBox())!;
    expect(b.height, `${sel} Höhe`).toBeGreaterThanOrEqual(43.5);
    expect(b.width, `${sel} Breite`).toBeGreaterThanOrEqual(43.5);
  }
}
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

for (const w of [390, 1280]) {
  test(`1) Tippziele ≥ 44 px – Mehr-Sprache, Umkreis-Chips – ${w}`, async ({ page }) => {
    await open(page, w);
    await page.locator('[data-k1-tab="mehr"]').click();
    await hit(page, '[data-k1-more] .k1-seg-sm button');
    await shot(page, `${w}-01-mehr-sprache`);
    await page.locator("[data-k1-open-search]").click();
    await hit(page, '[data-k1-search] .k1-seg button');
    const dash = page.locator('[data-k1-search] .k1-seg button', { hasText: "–" });
    expect((await dash.boundingBox())!.width).toBeGreaterThanOrEqual(43.5);
    await shot(page, `${w}-02-umkreis-chips`);
  });

  test(`1) Tippziele ≥ 44 px – Landing-Fußzeile, „Nur diesmal zur Karte“ – ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w >= 1024 ? 800 : 844 });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`/?${K1}`);
    const once = page.locator("[data-bl-landing-once]");
    await expect(once).toBeVisible();
    expect((await once.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await hit(page, "footer a, footer button");
    await once.scrollIntoViewIfNeeded();
    await shot(page, `${w}-03-landing-fusszeile`);
  });

  test(`2) Kartenattribution EN übersetzt, Quellnamen unverändert – ${w}`, async ({ page }) => {
    await open(page, w);
    const attr = page.locator(".leaflet-control-attribution");
    await expect.poll(() => attr.textContent()).toContain("Daten ©");
    await page.locator('[data-k1-tab="mehr"]').click();
    await page.locator('[data-k1-more] .k1-seg-sm button', { hasText: "EN" }).click();
    await page.locator('[data-k1-tab="karte"]').click();
    await expect.poll(() => attr.textContent()).toContain("Data ©");
    const txt = (await attr.textContent()) ?? "";
    expect(txt).not.toContain("Daten");
    for (const n of ["OpenFreeMap", "OpenMapTiles", "OpenStreetMap"]) expect(txt).toContain(n);
    await page.evaluate(() => document.querySelector(".leaflet-bottom.leaflet-right")?.classList.add("bl-attr-open"));
    await shot(page, `${w}-04-attribution-en`);
  });

  test(`3) Singular bei 1 Station (DE und EN) – ${w}`, async ({ page }) => {
    await open(page, w, ONE);
    await page.locator("[data-k1-open-search]").click();
    const show = page.locator("[data-k1-search] .k1-primary");
    await expect(show).toHaveText("1 Station zeigen");
    await shot(page, `${w}-05-singular-de`);
    await page.locator("[data-k1-search] .bl-g-icon").last().click();
    if (w < 1024) {
      await expect(page.locator(".bl-g-grab-text")).toHaveText("1 Station");
      await shot(page, `${w}-06-singular-karte-de`);
    }
    await page.locator('[data-k1-tab="mehr"]').click();
    await page.locator('[data-k1-more] .k1-seg-sm button', { hasText: "EN" }).click();
    await page.locator('[data-k1-tab="karte"]').click();
    if (w < 1024) await expect(page.locator(".bl-g-grab-text")).toHaveText("1 station");
    await page.locator("[data-k1-open-search]").click();
    await expect(show).toHaveText("Show 1 station");
    await expect(page.locator("body")).not.toContainText(/Alle 1 Stationen|1 Stationen zeigen|All 1 stations|Show 1 stations/);
    await shot(page, `${w}-07-singular-en`);
  });
}

test("4) 1280: Satellitenvorschau in der Desktop-Liste mit Einwilligung (Mock, kein Esri)", async ({ page, context }) => {
  const esri: string[] = [];
  await context.route(/arcgis|esri/i, (r) => (esri.push(r.request().url()), r.abort()));
  await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes"));
  await open(page, 1280);
  const list = page.locator("[data-bl-list]");
  await expect(list).toBeVisible();
  const thumb = list.locator("[data-bl-list-sat]").first();
  await expect(thumb).toBeVisible();
  await expect(thumb.locator("[data-bl-sat]")).toHaveAttribute("data-bl-sat", "mock");
  // Quellen einmal vollständig unter der Liste (Mini-Vorschau zu klein für die Kette).
  const attr = list.locator("[data-bl-list-sat-attr]");
  await expect(attr).toBeVisible();
  await expect(attr).toContainText("Powered by Esri");
  await expect(attr).toContainText("Esri, Vantor, Earthstar Geographics, and the GIS User Community");
  expect(esri).toEqual([]);
  await shot(page, "1280-08-liste-sat-erlaubt");
});

test("4) 1280 ohne Einwilligung: keine Vorschau in der Liste, kein Esri-/Mock-Request", async ({ page, context }) => {
  const sat: string[] = [];
  await context.route(/arcgis|esri|mock-sat/i, (r) => (sat.push(r.request().url()), r.continue()));
  await open(page, 1280);
  await expect(page.locator("[data-bl-list] .bl-list-row").first()).toBeVisible();
  await expect(page.locator("[data-bl-list-sat]")).toHaveCount(0);
  await expect(page.locator("[data-bl-list-sat-attr]")).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(sat).toEqual([]);
  await shot(page, "1280-09-liste-ohne-einwilligung");
});

test("4) 390: mobile Liste bleibt ohne Zeilen-Vorschau (auch mit Einwilligung)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes"));
  await open(page, 390);
  await page.locator('[data-k1-tab="liste"]').click();
  await expect(page.locator("[data-bl-list] .bl-list-row").first()).toBeVisible();
  await expect(page.locator("[data-bl-list-sat]")).toHaveCount(0);
  await shot(page, "390-10-liste-mobil");
});
