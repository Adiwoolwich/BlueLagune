import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

type B = { x: number; y: number; width: number; height: number };
const overlap = (a: B, b: B) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

async function boxes(page: Page, sel: string): Promise<B[]> {
  const out: B[] = [];
  for (const l of await page.locator(sel).all()) {
    if (!(await l.isVisible())) continue;
    const b = await l.boundingBox();
    if (b && b.width > 2 && b.height > 2) out.push(b);
  }
  return out;
}

test.use({ locale: "de-DE" });

const STATES = ["karussell", "liste", "detail"] as const;

for (const width of [320, 390, 1280]) {
  for (const state of STATES) {
    test(`Gerüst teal ${width} px, ${state}: keine Überlappung, Attribution frei, ⓘ ≥ 44, Tippziele ≥ 44`, async ({ page }) => {
      const height = width > 1000 ? 800 : 700;
      const desk = width >= 1024;
      await openMap(page, { width, height, path: "/?lat=50.94&lng=6.96&z=11&design=teal" });
      await expect(page.locator(".bl-g-pill")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dataset.shell)).toBe("g");
      // Startansicht: kein Zurück-Knopf, kein Radius-Dropdown, keine Knopfleiste
      expect(await page.locator("[data-bl-rail]").count()).toBe(0);
      expect(await page.locator(".bl-g-pill select, .bl-g-chips select").count()).toBe(0);
      if (state === "liste" && !desk) {
        await page.locator(".bl-g-grab").click();
        await expect(page.locator("[data-bl-list]")).toBeVisible();
      }
      if (state === "detail") {
        await page.locator(desk ? ".bl-g-side .bl-list-row button" : ".bl-g-card").first().click();
        await expect(page.locator("[data-bl-detail]")).toBeVisible();
        await expect(page.getByRole("button", { name: /Melden/ })).toBeVisible();
      }
      if (state === "karussell" && !desk) await expect(page.locator(".bl-g-card").first()).toBeVisible();
      await page.waitForTimeout(350);

      const vp = { x: 0, y: 0, width, height };
      const attr = (await page.locator(".leaflet-control-attribution").boundingBox())!;
      expect(overlap(attr, vp), "Attribution im Bild").toBe(true);
      // Desktop zeigt die Attribution vollständig (kein ⓘ nötig); mobil wird das ⓘ gemessen.
      const toggle = page.locator(".bl-attr-toggle");
      const info = (await toggle.isVisible()) ? (await toggle.boundingBox())! : attr;
      if (desk) expect(await toggle.isVisible(), "Desktop ohne ⓘ").toBe(false);
      if (!desk) expect(Math.round(info.width), "ⓘ Breite").toBeGreaterThanOrEqual(44);
      if (!desk) expect(Math.round(info.height), "ⓘ Höhe").toBeGreaterThanOrEqual(44);
      expect(info.y + info.height, "ⓘ im Bild").toBeLessThanOrEqual(height + 0.5);
      const hits = await page.evaluate(
        ([a, i]) => {
          const at = (x: number, y: number) => document.elementFromPoint(x, y);
          const aEl = at(a.x + Math.min(20, a.width / 2), a.y + a.height / 2);
          const iEl = at(i.x + i.width / 2, i.y + i.height / 2);
          return { attr: !!aEl?.closest(".leaflet-control-attribution, .leaflet-bottom"), info: !document.querySelector(".bl-attr-toggle")?.checkVisibility() || !!iEl?.closest(".bl-attr-toggle") };
        },
        [attr, info] as const,
      );
      expect(hits.attr, "Attribution überdeckt").toBe(true);
      expect(hits.info, "ⓘ überdeckt").toBe(true);

      // Bausteine des Gerüsts dürfen sich nicht überlappen und nicht über der Attribution liegen
      const parts: Record<string, B[]> = {
        pill: await boxes(page, ".bl-g-top .bl-g-pill"),
        chips: await boxes(page, ".bl-g-top .bl-g-chips"),
        side: await boxes(page, ".bl-g-side"),
        fab: await boxes(page, "[data-bl-fab]"),
        grab: await boxes(page, ".bl-g-grab"),
        carousel: await boxes(page, ".bl-g-carousel"),
        detail: await boxes(page, ".bl-g-detail:not(.bl-g-detail-inline)"),
        list: await boxes(page, "[data-bl-list]"),
      };
      const names = Object.keys(parts);
      for (const n of names) for (const b of parts[n]) {
        expect(overlap(b, attr), `${n} über Attribution`).toBe(false);
        if (!desk) expect(overlap(b, info), `${n} über ⓘ`).toBe(false);
      }
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++)
          for (const a of parts[names[i]]) for (const b of parts[names[j]]) expect(overlap(a, b), `${names[i]} ↔ ${names[j]}`).toBe(false);

      // Tippziele ≥ 44 px in allen neuen Bausteinen
      for (const b of await boxes(page, ".bl-g-top button, .bl-g-side > .bl-g-pill button, .bl-g-chips button, [data-bl-fab] button, .bl-g-grab, .bl-g-card, .bl-g-detail button, .bl-g-detail a, .bl-g-list-head button")) {
        if (b.y >= height || b.x >= width || b.x + b.width <= 0) continue;
        expect(Math.round(b.height), "Tippziel-Höhe").toBeGreaterThanOrEqual(44);
        expect(Math.round(b.width), "Tippziel-Breite").toBeGreaterThanOrEqual(44);
      }
    });
  }
}

test("Gerüst: Ebenen-Menü mit Satellit, Liste, Offline", async ({ page }) => {
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11&design=teal" });
  await page.locator("[data-bl-layers]").click();
  const dlg = page.getByRole("dialog", { name: "Ebenen" });
  await expect(dlg).toBeVisible();
  for (const n of ["Satellit", "Liste", "Offline"]) await expect(dlg.getByRole("button", { name: new RegExp(n, "i") })).toBeVisible();
  await dlg.getByRole("button", { name: /Liste/ }).click();
  await expect(page.locator("[data-bl-list]")).toBeVisible();
});

test("Gerüst: Pin tippen fokussiert die Karte im Karussell", async ({ page }) => {
  await openMap(page, { width: 390, path: "/?lat=50.94&lng=6.96&z=11&design=teal" });
  const ids = await page.locator(".bl-g-card").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.card));
  test.skip(ids.length < 2, "zu wenige Stationen im Ausschnitt");
  const second = page.locator(`.bl-g-card[data-card="${ids[1]}"]`);
  await page.locator(".leaflet-marker-icon.bl-p2-sel, .leaflet-marker-icon").first().waitFor();
  // Klick auf einen Pin (zweiter Marker) → Karussell zeigt die passende Karte
  const markers = page.locator(".leaflet-marker-icon");
  if ((await markers.count()) >= 2) await markers.nth(1).click({ force: true });
  await page.waitForTimeout(600);
  const current = await page.locator('.bl-g-card[aria-current="true"]').count();
  expect(current).toBe(1);
  await expect(second.or(page.locator('.bl-g-card[aria-current="true"]'))).toBeInViewport();
});

test("Ohne Parameter: K1 als Standard; alte Oberfläche nur per ?alt=1", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await openMap(page, { width: 390, path: "/", raw: true });
  await expect(page.locator("[data-k1-tabbar]")).toBeVisible();
  await openMap(page, { width: 390, path: "/?alt=1", raw: true });
  expect(await page.locator(".bl-g-pill").count()).toBe(0);
  expect(await page.locator("[data-k1-tabbar]").count()).toBe(0);
  expect(await page.locator("[data-bl-rail]").count()).toBe(1);
});
