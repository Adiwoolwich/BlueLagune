import { expect, test, type Locator } from "@playwright/test";
import { dragMap, openK1, overlap } from "./pro-k1-helpers";

test.use({ locale: "de-DE" });

async function contrast(l: Locator) {
  return l.evaluate((el) => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    const rgb = (s: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 4)); };
    const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
    // Hintergrund: erste deckende Fläche nach oben, sonst Seitenhintergrund
    let n: Element | null = el; let bg = [255, 255, 255, 0];
    while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c[3]! > 200) { bg = c; break; } n = n.parentElement; }
    if (bg[3]! <= 200) bg = rgb(getComputedStyle(document.body).backgroundColor);
    const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`K1 Pro-Tab: Text- und Knopfkontrast ≥ 4,5:1 – ${scheme}`, async ({ page }) => {
    await openK1(page, { width: 390, scheme });
    await page.locator("[data-k1-pro-chip]").click();
    const tab = page.locator("[data-k1-pro]");
    for (const sel of ["h2", "li", "[data-bl-pro-price] p", "dt", "dd", "[data-bl-pro-cta]"]) {
      for (const el of await tab.locator(sel).all()) expect(await contrast(el), `${sel} ${scheme}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

for (const width of [320, 390, 1280]) {
  test(`K1 Pro-Tab: Tippziele ≥ 44 px, Schließen erreichbar, kein Querscrollen – ${width} px`, async ({ page }) => {
    await openK1(page, { width, height: width > 1000 ? 800 : 640 });
    await page.locator('[data-k1-tab="pro"]').click();
    const tab = page.locator("[data-k1-pro]");
    await expect(tab).toBeVisible();
    for (const b of await tab.getByRole("button").all()) {
      const bb = (await b.boundingBox())!;
      expect(bb.height).toBeGreaterThanOrEqual(44);
      expect(bb.width).toBeGreaterThanOrEqual(44);
    }
    const t = (await tab.boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(0);
    for (const el of await page.locator("[data-k1-tabbar], .leaflet-control-attribution").all()) {
      const b = await el.boundingBox();
      if (b && (await el.isVisible()) && width < 1000) expect(overlap(t, b)).toBe(false);
    }
    await tab.locator(".k1-sheet-body").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(tab.getByRole("button", { name: "Interesse zeigen" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await tab.getByRole("button", { name: "Schließen" }).first().click();
    await expect(tab).toHaveCount(0);
  });
}

for (const width of [320, 390, 1280]) {
  test(`K1: Chip und Offline-Hinweis gleichzeitig ohne Überlappung – ${width} px`, async ({ page }) => {
    await openK1(page, { width });
    await dragMap(page);
    const chip = page.locator("[data-k1-pro-chip]");
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const note = page.locator("[data-bl-offline-note]");
    await expect(note).toBeVisible();
    await expect(chip).toBeVisible();
    await page.waitForTimeout(250);
    expect(overlap((await chip.boundingBox())!, (await note.boundingBox())!)).toBe(false);
  });
}

test("K1 Pro: reduced-motion → keine Übergänge, sonst < 250 ms", async ({ page }) => {
  await openK1(page, { width: 390 });
  await page.locator("[data-k1-pro-chip]").click();
  const durs = await page.locator("[data-k1-pro] *").evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration.split(",").map((s) => parseFloat(s) * (s.includes("ms") ? 1 : 1000))).flat());
  expect(Math.max(0, ...durs)).toBeLessThan(250);
});
