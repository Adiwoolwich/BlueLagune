import { expect, test, type Page } from "@playwright/test";
import { openMap } from "./helpers";

type B = { x: number; y: number; width: number; height: number };
const overlap = (a: B, b: B) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

async function visibleBox(page: Page, sel: string): Promise<B[]> {
  const out: B[] = [];
  for (const l of await page.locator(sel).all()) {
    if (!(await l.isVisible())) continue;
    const vis = await l.evaluate((el) => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el.closest("[data-bl-rail]") ?? el).visibility !== "hidden");
    const b = await l.boundingBox();
    if (b && vis && b.width > 0) out.push(b);
  }
  return out;
}

async function setSheet(page: Page, step: "peek" | "mid" | "full") {
  const handle = page.locator(".bl-sheet-handle");
  if (!(await handle.isVisible())) return;
  await handle.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  if (step !== "peek") await page.keyboard.press("ArrowUp");
  if (step === "full") await page.keyboard.press("ArrowUp");
  await expect(page.locator("aside.bl-sheet")).toHaveAttribute("data-bl-sheet", step);
  await page.waitForTimeout(300);
}

for (const design of ["", "teal"]) {
  for (const width of [320, 390, 1280]) {
    for (const step of ["peek", "mid", "full"] as const) {
      test(`Basis: keine Überlappung ${design || "default"} ${width} px, Sheet ${step}`, async ({ page }) => {
        const height = width > 1000 ? 800 : 700;
        await openMap(page, { width, height, path: `/?lat=50.94&lng=6.96&z=12${design ? `&design=${design}` : ""}` });
        await setSheet(page, step);
        const vp = { x: 0, y: 0, width, height };
        const sheetRaw = (await page.locator("aside.bl-sheet").boundingBox())!;
        // nur der sichtbare Teil des Sheets zählt
        const top = Math.max(sheetRaw.y, 0);
        // neue Optik schneidet den verschobenen Teil per clip-path ab (sichtbares Ende = Unterkante − Offset)
        const clipBottom = await page.evaluate(() => {
          const el = document.querySelector("aside.bl-sheet") as HTMLElement;
          const r = el.getBoundingClientRect();
          if (!getComputedStyle(el).clipPath.includes("inset")) return r.bottom;
          const off = parseFloat(el.style.getPropertyValue("--sheet-offset")) || 0;
          return r.bottom - (off * window.innerHeight) / 100;
        });
        const sheet = { ...sheetRaw, y: top, height: Math.min(clipBottom, height) - top };
        const attr = (await page.locator(".leaflet-control-attribution").boundingBox())!;
        expect(attr, "Attribution sichtbar").toBeTruthy();
        expect(overlap(attr, vp), "Attribution im Bild").toBe(true);
        expect(overlap(attr, sheet), "Sheet verdeckt Attribution").toBe(false);
        // Attribution tatsächlich oben auf (nichts liegt darüber)
        const onTop = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return !!el?.closest(".leaflet-control-attribution, .leaflet-bottom, .leaflet-top");
        }, { x: attr.x + Math.min(20, attr.width / 2), y: attr.y + attr.height / 2 });
        expect(onTop, "Attribution von etwas überdeckt").toBe(true);
        for (const b of await visibleBox(page, "[data-bl-rail] button")) expect(overlap(b, sheet), "Rail-Knopf über Sheet").toBe(false);
        for (const b of await visibleBox(page, "[data-bl-search]")) expect(overlap(b, sheet), "Suche über Sheet").toBe(false);
        for (const b of await visibleBox(page, "[data-bl-offline-note]")) expect(overlap(b, sheet)).toBe(false);
        // Tippziele im Sheet ≥ 44 px
        for (const b of await visibleBox(page, "aside.bl-sheet button, aside.bl-sheet [role=button]")) {
          if (b.y + b.height <= top || b.y >= height || b.width <= 2) continue; // sr-only
          expect(Math.round(b.height), "Tippziel-Höhe").toBeGreaterThanOrEqual(44);
        }
      });
    }
  }
}

test("Design-Parameter setzt Tokens, ohne Parameter keine", async ({ page }) => {
  await openMap(page, { width: 390, path: "/?design=teal" });
  expect(await page.evaluate(() => document.documentElement.dataset.design)).toBe("teal");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bl-accent").trim())).not.toBe("");
  await openMap(page, { width: 390, path: "/" });
  expect(await page.evaluate(() => document.documentElement.dataset.design ?? "")).toBe("");
});
