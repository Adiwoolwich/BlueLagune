import { expect, test } from "@playwright/test";
import { dragMap, openK1, overlap } from "./pro-k1-helpers";

test.use({ locale: "de-DE" });

for (const [v, q, head] of [["europa", "eu", "Entsorgen ohne böse Überraschung – in ganz Europa."], ["frankreich", "fr", "Frankreichs Aires de services auf deiner Karte"]] as const) {
  test(`K1: Chip sichtbar, pro_chip_seen erst nach Kartengeste und nur einmal, Pro-Tab ${v}`, async ({ page, context }) => {
    const metric: unknown[] = []; const cookies: (string | undefined)[] = [];
    page.on("request", (r) => { if (r.url().endsWith("/api/metric")) { metric.push(r.postDataJSON()); cookies.push(r.headers()["cookie"]); } });
    await openK1(page, { width: 390, q });
    const chip = page.locator("[data-k1-pro-chip]");
    await expect(chip).toBeVisible();
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(400);
    expect(metric).toEqual([]);
    await dragMap(page);
    await expect.poll(() => metric).toEqual([{ e: "pro_chip_seen", v: q }]);
    await dragMap(page);
    await page.waitForTimeout(300);
    expect(metric).toHaveLength(1);
    const storeBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await chip.click();
    const tab = page.locator("[data-k1-pro]");
    await expect(tab).toBeVisible();
    await expect(page.locator('[data-k1-tab="pro"]')).toHaveAttribute("aria-current", "page");
    await expect(tab.getByRole("heading", { level: 2 })).toHaveText(head);
    const price = tab.locator("[data-bl-pro-price]");
    await expect(price).toContainText("9,99 € pro Jahr inkl. MwSt.");
    await expect(price).toContainText("Vorschau – noch nicht erhältlich, nichts wird berechnet");
    await expect(tab).toContainText("Test läuft bis 27.11.2026");
    await expect(tab.locator("dl dt").first()).toBeVisible();
    await expect(tab.locator("input, form")).toHaveCount(0);
    await tab.getByRole("button", { name: "Interesse zeigen" }).click();
    await expect(tab).toContainText("Danke! Wir zählen nur anonym mit");
    await expect.poll(() => metric).toEqual([{ e: "pro_chip_seen", v: q }, { e: "pro_interest", v: q }]);
    expect(cookies.every((c) => !c)).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(storeBefore);
    expect(await context.cookies()).toEqual([]);
  });
}

test("K1: Pro-Tab über Tab-Leiste öffnet denselben Inhalt; ohne Kartengeste kein pro_chip_seen", async ({ page }) => {
  const metric: unknown[] = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/metric")) metric.push(r.postDataJSON()); });
  await openK1(page, { width: 390 });
  await page.locator('[data-k1-tab="pro"]').click();
  await expect(page.locator("[data-k1-pro] [data-bl-pro-price]")).toBeVisible();
  await page.waitForTimeout(300);
  expect(metric).toEqual([]);
});

test("Seite /pro zeigt denselben Inhalt, ohne Formular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pro?pro=eu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Entsorgen ohne böse Überraschung – in ganz Europa.");
  await expect(page.getByRole("button", { name: "Interesse zeigen" })).toBeVisible();
  await expect(page.locator("input, form")).toHaveCount(0);
});

for (const width of [320, 390, 1280]) {
  test(`K1: Pro-Chip überlappt weder Attribution, Suche, Tab-Leiste noch Werkzeuge – ${width} px`, async ({ page }) => {
    await openK1(page, { width });
    const chip = page.locator("[data-k1-pro-chip]");
    await expect(chip).toBeVisible();
    const c = (await chip.boundingBox())!;
    expect(c.x + c.width).toBeLessThanOrEqual(width);
    for (const sel of [".leaflet-control-attribution", ".k1-top button", "[data-k1-tabbar]", ".leaflet-control a", "[data-bl-offline-note]"]) for (const el of await page.locator(sel).all()) {
      const b = await el.boundingBox();
      if (b && (await el.isVisible())) expect(overlap(c, b), `Chip überlappt ${sel}`).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
