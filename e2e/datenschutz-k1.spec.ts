import { expect, test } from "@playwright/test";

test.use({ locale: "de-DE" });

test("Datenschutz: Kapitel Satellitenvorschau mit Status und Widerruf (bl-sat-preview + -later)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) { localStorage.setItem("bl-sat-preview", "yes"); localStorage.setItem("bl-sat-preview-ok", "1"); sessionStorage.setItem("bl-sat-preview-later", "1"); sessionStorage.setItem("seeded", "1"); }
  });
  await page.goto("/datenschutz");
  const sec = page.locator("#satellitenvorschau");
  await expect(sec.getByRole("heading", { level: 2 })).toHaveText("Satellitenvorschau");
  await expect(sec).toContainText("Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG).");
  await expect(sec.locator("[data-bl-sat-status]")).toContainText("erteilt");
  const btn = sec.getByRole("button", { name: "Einwilligung widerrufen" });
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.click();
  await expect(sec.locator("[data-bl-sat-status]")).toContainText("nicht erteilt");
  await expect(sec.locator("[role=status]")).toContainText("widerrufen");
  await expect(btn).toBeDisabled();
  expect(await page.evaluate(() => [localStorage.getItem("bl-sat-preview"), sessionStorage.getItem("bl-sat-preview-later"), localStorage.getItem("bl-sat-preview-ok")])).toEqual([null, null, "1"]);
  // nur einmal im Dokument
  await expect(page.getByText("Satellitenvorschau und -karte (Esri ArcGIS)")).toHaveCount(1);
  await expect(page.locator("body")).toContainText("Local Storage: Filter, Merkliste, deine zuletzt eingegebenen Suchbegriffe („Zuletzt gesucht“) und deine Wahl zur Satellitenvorschau");
  await expect(page.locator("body")).toContainText("Tageszähler (Test „Pro Europa“)");
  await expect(page.locator("[data-bl-privacy-visit]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Datenschutz EN: Satellite preview chapter", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bl-lang", "en"));
  await page.goto("/datenschutz?lang=en");
  const sec = page.locator("#satellitenvorschau");
  await expect(sec.getByRole("heading", { level: 2 })).toHaveText("Satellite preview");
  await expect(sec.getByRole("button", { name: "Withdraw consent" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`Datenschutz: Widerruf-Knopf + Status über --bl-*, Kontrast ≥ 4,5:1, ≥ 44 px – ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("bl-sat-preview", "yes"));
    await page.goto("/datenschutz");
    const sec = page.locator("#satellitenvorschau");
    const btn = sec.locator("[data-bl-sat-revoke]");
    const status = sec.locator("[data-bl-sat-status]");
    const r = await page.evaluate(() => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 1;
      const cx = cv.getContext("2d", { willReadFrequently: true })!;
      const rgb = (s: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); return Array.from(cx.getImageData(0, 0, 1, 1).data.slice(0, 4)); };
      const lum = (c: number[]) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
      const bgOf = (el: Element) => { let n: Element | null = el; while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c[3]! > 200) return c; n = n.parentElement; } return [255, 255, 255, 255]; };
      const cr = (el: Element) => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bgOf(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const sec = document.querySelector("#satellitenvorschau")!;
      const v = (k: string) => getComputedStyle(sec).getPropertyValue(k).trim();
      const btn = sec.querySelector("[data-bl-sat-revoke]")!, st = sec.querySelector("[data-bl-sat-status]")!;
      return { accent: rgb(v("--bl-accent")).join(), btnBg: rgb(getComputedStyle(btn).backgroundColor).join(), text: rgb(v("--bl-text")).join(), stColor: rgb(getComputedStyle(st).color).join(), btn: cr(btn), st: cr(st) };
    });
    console.log(`KONTRAST ${scheme}: Knopf ${r.btn.toFixed(2)}:1, Status ${r.st.toFixed(2)}:1`);
    expect(r.accent).not.toBe("0,0,0,0");
    expect(r.btnBg).toBe(r.accent);
    expect(r.stColor).toBe(r.text);
    expect(r.btn).toBeGreaterThanOrEqual(4.5);
    expect(r.st).toBeGreaterThanOrEqual(4.5);
    const bb = (await btn.boundingBox())!;
    expect(bb.height).toBeGreaterThanOrEqual(43.5);
    await expect(status).toBeVisible();
    await btn.click();
    await expect(btn).toBeDisabled();
    const d = await btn.evaluate((el) => { const s = getComputedStyle(el); return [s.color, s.backgroundColor]; });
    expect(d[0]).not.toBe(d[1]);
  });
}

test("Datenschutz: Esri-Links im Kapitel klickbar, rel=noopener, Wortlaut unverändert, Tippfläche ≥ 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/datenschutz");
  const sec = page.locator("#satellitenvorschau");
  for (const href of ["https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement", "https://trust.arcgis.com/en/compliance/gdpr.htm"]) {
    const a = sec.locator(`a[href="${href}"]`);
    await expect(a).toHaveText(href);
    await expect(a).toHaveAttribute("rel", /noopener/);
    await expect(a).toHaveAttribute("target", "_blank");
    const h = await a.evaluate((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { h: r.height, pad: parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.lineHeight || "0") }; });
    expect(Math.max(h.h, h.pad)).toBeGreaterThanOrEqual(43.5);
  }
  await expect(sec.locator("p").first()).toContainText("Mehr Infos: https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement und https://trust.arcgis.com/en/compliance/gdpr.htm.");
});

test("Vorschau-Attribution im Mock: Powered by Esri + Fallback Esri-Vantor-Kette, kein Netz zu Esri", async ({ page }) => {
  const esri: string[] = [];
  page.on("request", (r) => { if (/arcgis|esri\.com/i.test(r.url())) esri.push(r.url()); });
  await page.addInitScript(() => { localStorage.setItem("bl-skip-landing", "1"); localStorage.setItem("bl-sat-preview", "yes"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lat=50.94&lng=6.96&z=11&design=teal&konzept=1");
  const attr = page.locator(".bl-sat-attr").first();
  await expect(attr).toBeVisible({ timeout: 15000 });
  await expect(attr).toContainText("Powered by Esri | Esri, Vantor, Earthstar Geographics, and the GIS User Community");
  await expect(attr).not.toContainText("Esri, Maxar");
  expect(esri).toEqual([]);
});
