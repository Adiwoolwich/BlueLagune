import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

// Lex 30.10.: Esri-Quellenzeile in der Desktop-Liste (K1, ≥ 1024 px, nur mit Einwilligung).
test.use({ locale: "de-DE", serviceWorkers: "block" });
const PATH = "/?lat=50.94&lng=6.96&z=9&design=teal&konzept=1"; // viele Stationen → Liste scrollt
const CHAIN = "Powered by Esri | Esri, Vantor, Earthstar Geographics, and the GIS User Community";
const SHOTS = process.env.BL_SHOTS;

async function open(page: Page, consent: boolean) {
  await page.addInitScript((c) => {
    localStorage.setItem("bl-skip-landing", "1");
    if (c) localStorage.setItem("bl-sat-preview", "yes");
  }, consent);
  await openMap(page, { width: 1280, height: 800, path: PATH });
  await expect(page.locator("[data-bl-list] .bl-list-row").first()).toBeVisible();
}
async function toEn(page: Page) {
  await page.locator('[data-k1-tab="mehr"]').click();
  await page.locator('[data-k1-more] .k1-seg-sm button', { hasText: "EN" }).click();
  await page.locator('[data-k1-tab="karte"]').click();
  await expect(page.locator("[data-bl-list] .bl-list-row").first()).toBeVisible();
}

for (const lang of ["de", "en"] as const) {
  test(`1280 ${lang}: Quellenzeile sticky, Präfix, Kette wörtlich, Esri-Link, ≥ 12 px, © an jedem Bild`, async ({ page, context }) => {
    const esri: string[] = [];
    await context.route(/arcgis|esri\.com/i, (r) => (esri.push(r.request().url()), r.abort()));
    await open(page, true);
    if (lang === "en") await toEn(page);
    const panel = page.locator("[data-bl-list]");
    const line = panel.locator("[data-bl-list-sat-attr]");
    await expect(line).toBeVisible();
    const txt = (await line.textContent())!.replace(/\s+/g, " ");
    expect(txt).toContain(`${lang === "de" ? "Satellitenbilder:" : "Satellite imagery:"} ${CHAIN}`);
    expect(txt).not.toContain(lang === "de" ? "Satellite imagery" : "Satellitenbilder");
    // Schriftgröße gemessen
    expect(parseFloat(await line.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
    // Esri-Link
    const link = line.locator("a[data-bl-esri-link]");
    await expect(link).toHaveText("Esri");
    await expect(link).toHaveAttribute("href", "https://www.esri.com");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const lb = (await link.boundingBox())!;
    expect(lb.height).toBeGreaterThanOrEqual(43.5);
    expect(lb.width).toBeGreaterThanOrEqual(43.5);
    // © Esri an jedem Vorschaubild
    const thumbs = panel.locator("[data-bl-list-sat]");
    // Bilder laden erst sichtbar (lazy) → jedes geladene Bild (data-bl-sat=mock) trägt „© Esri“, Platzhalter nicht.
    const loaded = thumbs.locator('[data-bl-sat="mock"]');
    await expect.poll(() => loaded.count()).toBeGreaterThan(3);
    const everyCredit = async () => {
      const n = await loaded.count();
      await expect(loaded.locator("[data-bl-sat-credit]")).toHaveCount(n);
      await expect(thumbs.locator('[data-bl-sat="vector"] [data-bl-sat-credit]')).toHaveCount(0);
    };
    await everyCredit();
    const first = thumbs.first();
    await expect(first.locator("[data-bl-sat-credit]")).toHaveText("© Esri");
    const cb = (await first.locator("[data-bl-sat-credit]").boundingBox())!;
    const tb = (await first.boundingBox())!;
    expect((cb.width * cb.height) / (tb.width * tb.height)).toBeLessThan(0.2);
    expect(parseFloat(await first.locator("[data-bl-sat-credit]").evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(10);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1280-${lang}-01-oben.png` });
    // Scroll-Fall: Zeile bleibt am unteren Panelrand sichtbar
    const scroller = panel.locator("ul.bl-scroll");
    const before = (await line.boundingBox())!;
    const moved = await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
    expect(moved).toBeGreaterThan(100);
    await page.waitForTimeout(200);
    const after = (await line.boundingBox())!;
    const pb = (await panel.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    expect(after.y + after.height).toBeLessThanOrEqual(pb.y + pb.height + 1);
    expect(after.y + after.height).toBeGreaterThan(pb.y + pb.height - 40);
    await expect(line).toBeInViewport();
    await everyCredit();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/1280-${lang}-02-gescrollt.png` });
    expect(esri).toEqual([]);
  });
}

test("1280 ohne Einwilligung: weder Zeile noch Vorschau noch © – kein Request", async ({ page, context }) => {
  const sat: string[] = [];
  await context.route(/arcgis|esri\.com|mock-sat/i, (r) => (sat.push(r.request().url()), r.continue()));
  await open(page, false);
  await expect(page.locator("[data-bl-list-sat-attr]")).toHaveCount(0);
  await expect(page.locator("[data-bl-list-sat]")).toHaveCount(0);
  await expect(page.locator("[data-bl-sat-credit]")).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(sat).toEqual([]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1280-de-03-ohne-einwilligung.png` });
});
