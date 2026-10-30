import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

test.use({ locale: "de-DE" });
const PATH = "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1";
const SEED = ["Köln", "Venlo", "Aachen", "Bonn", "Essen", "Trier", "Mainz"];

test("Zuletzt gesucht: X je Eintrag und „Verlauf löschen“ (≥ 44 px), höchstens 5", async ({ page }) => {
  await page.addInitScript((seed) => {
    localStorage.setItem("bl-skip-landing", "1");
    if (!sessionStorage.getItem("s")) { localStorage.setItem("bl-recent-q", JSON.stringify(seed)); sessionStorage.setItem("s", "1"); }
  }, SEED);
  await openMap(page, { width: 390, path: PATH });
  await page.locator("[data-k1-open-search]").click();
  const items = page.locator("[data-k1-recent-item]");
  await expect(items).toHaveCount(5);
  for (const sel of ["[data-k1-recent-x]", "[data-k1-recent] .k1-link"]) {
    const b = (await page.locator(sel).first().boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(43.5);
    expect(b.width).toBeGreaterThanOrEqual(43.5);
  }
  await page.getByRole("button", { name: "„Venlo“ aus dem Verlauf löschen" }).click();
  await expect(items).toHaveCount(4);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("bl-recent-q")))!)).not.toContain("Venlo");
  await page.locator("[data-k1-recent] .k1-link").click();
  await expect(page.locator("[data-k1-recent]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("bl-recent-q"))).toBeNull();
});

test("Suchbegriff und Verlauf gehen nie an Sentry, /api/metric oder Analyse", async ({ page }) => {
  const TERM = "Geheimort4711";
  const leaks: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/nominatim|photon/i.test(u)) return; // Ortssuche selbst (Geocoding) ist die Suchfunktion
    const body = r.postData() ?? "";
    const hit = (u + body).includes(TERM) || (u + body).includes(encodeURIComponent(TERM));
    if (hit || (/sentry|\/api\/metric|analytics|plausible|umami/i.test(u) && /Geheim|bl-recent/.test(u + body))) leaks.push(u);
  });
  await page.addInitScript((t) => {
    localStorage.setItem("bl-skip-landing", "1");
    localStorage.setItem("bl-recent-q", JSON.stringify([t + "-alt"]));
  }, TERM);
  await openMap(page, { width: 390, path: PATH });
  await page.locator("[data-k1-open-search]").click();
  await page.locator("[data-k1-search] input").first().fill(TERM);
  await page.waitForTimeout(1500);
  await page.locator('[data-k1-search] [aria-label="Schließen"]').click();
  await page.waitForTimeout(800);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("bl-recent-q")))!)[0]).toBe(TERM);
  expect(leaks).toEqual([]);
});
