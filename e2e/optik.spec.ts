import { expect, test } from "@playwright/test";
import { openMap } from "./helpers";

function lum(rgb: number[]) {
  const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

test("Startseite: Karte sofort sichtbar (keine Vorschaltseite)", async ({ page }) => {
  await openMap(page, { width: 390 });
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("searchbox").or(page.locator('[data-bl-search] input')).first()).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`Theme ${scheme} folgt prefers-color-scheme`, async ({ page }) => {
    await openMap(page, { width: 390, scheme });
    const bg = await page.locator("aside").evaluate((el) => getComputedStyle(el).backgroundColor);
    const rgb = bg.match(/\d+/g)!.slice(0, 3).map(Number);
    if (scheme === "light") expect(lum(rgb)).toBeGreaterThan(0.8);
    else expect(lum(rgb)).toBeLessThan(0.05);
    const theme = await page.locator("html").evaluate((el) => getComputedStyle(el).colorScheme);
    expect(theme).toContain(scheme);
  });

  test(`AA-Kontrast aller sichtbaren Texte (${scheme})`, async ({ page }) => {
    await openMap(page, { width: 390, scheme });
    const fails = await page.evaluate(() => {
      const parse = (s: string) => { const m = s.match(/[\d.]+/g)!.map(Number); return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
      const L = (rgb: number[]) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const bgOf = (el: Element | null): number[] | null => {
        const stack: { c: number[]; a: number }[] = [];
        for (let e = el; e; e = e.parentElement) {
          const b = parse(getComputedStyle(e).backgroundColor);
          if (b.a > 0) { stack.push(b); if (b.a >= 0.99) break; }
          if (e.classList.contains("leaflet-container")) return null;
        }
        if (!stack.length || stack[stack.length - 1].a < 0.99) return null; // über Karte ohne eigenen Grund
        let c = stack.pop()!.c;
        while (stack.length) { const t = stack.pop()!; c = c.map((v, i) => t.c[i] * t.a + v * (1 - t.a)); }
        return c;
      };
      const out: string[] = [];
      const roots = document.querySelectorAll('aside, [data-bl-keep-clear], [data-bl-rail]');
      roots.forEach((root) => root.querySelectorAll("*").forEach((el) => {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
        if (!own) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || Number(cs.opacity) < 0.1 || el.closest('[aria-hidden="true"], .sr-only, :disabled')) return;
        const bg = bgOf(el);
        if (!bg) { out.push("kein Grund: " + el.textContent!.trim().slice(0, 30)); return; }
        const fg = parse(cs.color);
        const f = fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
        const l1 = L(f), l2 = L(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        if (ratio < need) out.push(`${el.textContent!.trim().slice(0, 30)} ${ratio.toFixed(2)}`);
      }));
      return out;
    });
    expect(fails).toEqual([]);
  });
}

test("Desktop ≥1024: schwebendes Seitenpanel links, Karte daneben sichtbar", async ({ page }) => {
  await openMap(page, { width: 1280, height: 800 });
  const box = (await page.locator("aside").boundingBox())!;
  expect(box.x).toBeLessThan(40);
  expect(box.width).toBeLessThanOrEqual(440);
  expect(box.y).toBeLessThan(200);
});

test("Mobil <1024: Bottom-Sheet über volle Breite", async ({ page }) => {
  await openMap(page, { width: 1000, height: 800 });
  const box = (await page.locator("aside").boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(1000);
});

for (const width of [320, 390]) {
  test(`kein Querscrollen bei ${width} px`, async ({ page }) => {
    await openMap(page, { width });
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      const wide = [...document.querySelectorAll('aside *, [data-bl-keep-clear] *')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".bl-chips"); })
        .map((e) => e.tagName + "." + (e.className?.toString?.() ?? "").slice(0, 40));
      return { sw: d.scrollWidth, cw: d.clientWidth, wide };
    });
    expect(over.sw).toBeLessThanOrEqual(over.cw);
    expect(over.wide).toEqual([]);
  });

  test(`Tippziele ≥ 44 px bei ${width} px`, async ({ page }) => {
    await openMap(page, { width });
    const small = await page.evaluate(() => [...document.querySelectorAll('aside button, aside a, aside select, aside input, aside [role="button"], [data-bl-keep-clear] button, [data-bl-keep-clear] input, [data-bl-rail] button, .leaflet-marker-icon')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !e.closest('[aria-hidden="true"]'); })
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || (r.width < 44 && e.tagName !== "INPUT"); })
      .map((e) => `${e.tagName} ${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 25)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
    expect(small).toEqual([]);
  });
}

test("Marker sind rund (Tesla-Stil), Cluster rund mit Zahl", async ({ page }) => {
  await openMap(page, { width: 1280, height: 800 });
  await expect(page.locator(".bl-pin, .bl-cl").first()).toBeVisible();
  expect(await page.locator(".bl-drop").count()).toBe(0);
});
