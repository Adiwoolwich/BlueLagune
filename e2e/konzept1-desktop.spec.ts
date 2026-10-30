import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

test.use({ locale: "de-DE" });
const PATH = "/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1";

async function open(page: import("@playwright/test").Page, width: number) {
  await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await openMap(page, { width, height: width >= 1024 ? 800 : 844, path: PATH });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
}
const box = async (page: import("@playwright/test").Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test("Desktop 1280: Panel links mit Suche, Tabs als Navigation und Liste; Karte rechts", async ({ page }) => {
  await open(page, 1280);
  await expect(page.locator("[data-k1-layout=desktop]")).toBeVisible();
  const tabs = await box(page, "[data-k1-tabbar]");
  expect(tabs.x).toBeLessThan(5);
  expect(tabs.width).toBeLessThanOrEqual(401);
  expect(tabs.y).toBeLessThan(120);
  const map = await box(page, "main");
  expect(map.x).toBeGreaterThanOrEqual(399);
  await expect(page.locator("[data-bl-list]")).toBeVisible();
  const list = await box(page, "[data-bl-list]");
  expect(list.x + list.width).toBeLessThanOrEqual(401);
  await page.locator('[data-k1-tab="mehr"]').click();
  const more = await box(page, "[data-k1-more]");
  expect(more.x + more.width).toBeLessThanOrEqual(401);
  await expect(page.locator("[data-k1-pro-chip]")).toBeVisible();
  const chip = await box(page, "[data-k1-pro-chip]");
  expect(chip.x).toBeGreaterThan(400);
});

test("Pro-Chip auf der Karte sichtbar (390 und 1280) und öffnet den Pro-Tab", async ({ page }) => {
  for (const w of [390, 1280]) {
    await open(page, w);
    const chip = page.locator("[data-k1-pro-chip]");
    await expect(chip).toBeVisible();
    const b = (await chip.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    await chip.click();
    await expect(page.locator("[data-k1-pro]")).toBeVisible();
    await expect(page.locator('[data-k1-tab="pro"]')).toHaveAttribute("aria-current", "page");
  }
});

test("390: Tab-Bar unten, alle Tabs ≥ 44 px", async ({ page }) => {
  await open(page, 390);
  const tb = await box(page, "[data-k1-tabbar]");
  expect(tb.y).toBeGreaterThan(700);
  for (const b of await page.locator("[data-k1-tab]").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("Suche 390: „In meiner Nähe“ ohne Überlappung, Tippziel ≥ 44 px; zuletzt gesucht bleibt (bl-recent-q) und ist löschbar", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("bl-recent-q", JSON.stringify(["Köln", "Venlo"])); sessionStorage.setItem("seeded", "1"); } });
  await open(page, 390);
  await page.locator("[data-k1-open-search]").click();
  const near = page.locator("[data-k1-near]");
  const nb = (await near.boundingBox())!;
  const btn = (await near.locator("button").boundingBox())!;
  const lbl = (await near.locator(".k1-quick-label").boundingBox())!;
  expect(btn.height).toBeGreaterThanOrEqual(44);
  expect(btn.width).toBeGreaterThanOrEqual(44);
  expect(nb.height).toBeGreaterThanOrEqual(44);
  const overlap = !(lbl.x + lbl.width <= btn.x || btn.x + btn.width <= lbl.x || lbl.y + lbl.height <= btn.y || btn.y + btn.height <= lbl.y);
  expect(overlap).toBe(false);
  expect(btn.x + btn.width).toBeLessThanOrEqual(nb.x + nb.width + 0.5);
  await expect(page.locator("[data-k1-recent] .k1-chip")).toHaveText(["Köln", "Venlo"]);
  await page.locator("[data-k1-recent] .k1-link").click();
  await expect(page.locator("[data-k1-recent]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("bl-recent-q"))).toBeNull();
});
