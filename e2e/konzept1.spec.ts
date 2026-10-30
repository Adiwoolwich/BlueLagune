import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

test.use({ locale: "de-DE" });
const PATH = "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1";
const OUT = process.env.K1_SHOTS; // Ausgabeordner für Screens (optional)

async function open(page: Page, opts: { sat?: "yes" | null } = {}) {
  const reqs: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/mock-sat/") || /arcgis|esri/i.test(u)) reqs.push(u);
  });
  await page.addInitScript((sat) => {
    localStorage.setItem("bl-skip-landing", "1");
    if (sat) localStorage.setItem("bl-sat-preview", sat);
  }, opts.sat ?? null);
  await openMap(page, { width: 390, height: 844, path: PATH });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
  return reqs;
}

test("Konzept 1: kein Sat-Request vor dem Ja, Nicht jetzt bleibt Miniatur", async ({ page }) => {
  const reqs = await open(page);
  await expect(page.locator("[data-bl-sat-ask]")).toBeVisible();
  await page.waitForTimeout(600);
  expect(reqs).toEqual([]);
  await expect(page.locator('[data-bl-sat="vector"]').first()).toBeVisible();
  await page.locator("[data-bl-sat-later]").click();
  await expect(page.locator("[data-bl-sat-ask]")).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(reqs).toEqual([]);
  expect(await page.evaluate(() => [localStorage.getItem("bl-sat-preview"), sessionStorage.getItem("bl-sat-preview-later")])).toEqual([null, "1"]);
  // Klick auf den Platzhalter fragt erneut
  await page.locator("[data-bl-sat-placeholder]").first().click();
  await expect(page.locator("[data-bl-sat-ask]")).toBeVisible();
});

test("Konzept 1: Erlauben lädt nur Mock-Kacheln sichtbarer Karten mit Attribution; Widerruf im Menü Datenschutz", async ({ page }) => {
  const reqs = await open(page);
  await page.locator("[data-bl-sat-allow]").click();
  await expect(page.locator('[data-bl-sat="mock"]').first()).toBeVisible();
  await expect(page.locator(".bl-sat-attr").first()).toContainText("Powered by Esri | Esri, Vantor, Earthstar Geographics, and the GIS User Community");
  await page.waitForTimeout(400);
  expect(reqs.length).toBeGreaterThan(0);
  expect(reqs.every((u) => new URL(u).pathname.startsWith("/mock-sat/"))).toBe(true);
  const cards = await page.locator("[data-card]").count();
  expect(new Set(reqs.map((u) => u)).size).toBeLessThan(cards * 4); // lazy: nicht alle Karten
  await page.locator('[data-k1-tab="mehr"]').click();
  await expect(page.locator("[data-k1-privacy]")).toContainText("Datenschutz");
  await page.locator("[data-k1-sat-revoke]").click();
  expect(await page.evaluate(() => localStorage.getItem("bl-sat-preview"))).toBeNull();
  await page.locator('[data-k1-tab="mehr"]').click();
  await expect(page.locator('[data-bl-sat="mock"]')).toHaveCount(0);
});

test("Konzept 1: Satellit-Ebene läuft über dieselbe Einwilligung; Sprache nur DE/EN", async ({ page }) => {
  await open(page);
  await page.locator("[data-bl-sat-later]").click();
  await page.locator("[data-bl-layers]").click();
  await page.locator("[data-k1-layers] button", { hasText: "Satellit" }).click();
  await expect(page.locator("[data-bl-sat-ask]")).toBeVisible();
  await page.locator('[data-k1-tab="mehr"]').click();
  await expect(page.locator('[data-k1-more] [aria-label="Sprache"] button')).toHaveText(["DE", "EN"]);
});

test("Ohne Parameter K1, ?alt=1 alte Oberfläche, ?design ohne ?konzept das Gerüst", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11", raw: true });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11&alt=1" });
  await expect(page.locator("[data-k1-tabbar]")).toHaveCount(0);
  await expect(page.locator(".bl-g-pill")).toHaveCount(0);
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11&design=teal" });
  await expect(page.locator(".bl-g-pill")).toBeVisible();
  await expect(page.locator("[data-k1-tabbar]")).toHaveCount(0);
});

test("Konzept 1 Screens 390 px", async ({ page }) => {
  test.skip(!OUT, "nur mit K1_SHOTS");
  await open(page, { sat: "yes" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/konzept1-karte-390.png` });
  await page.locator("[data-card]").first().click();
  await expect(page.locator("[data-bl-detail]")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/konzept1-station-390.png` });
  await page.locator("[data-bl-detail] [aria-label=\"Schließen\"]").first().click().catch(() => {});
  await page.goto(PATH); await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
  await page.locator("[data-k1-open-search]").click();
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll("[data-k1-search] *").forEach((e) => ((e as HTMLElement).scrollTop = 0)));
  await page.screenshot({ path: `${OUT}/konzept1-suche-390.png` });
  await page.locator('[data-k1-search] [aria-label="Schließen"]').click();
  await page.locator('[data-k1-tab="mehr"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/konzept1-menue-390.png` });
});

test("Rechtsseiten: Sprachumschalter im Footer nur DE/EN", async ({ page }) => {
  for (const p of ["/impressum", "/datenschutz"]) {
    await page.goto(p);
    const g = page.locator("footer [role=group]").first();
    await expect(g.locator("button")).toHaveText(["DE", "EN"]);
  }
});
