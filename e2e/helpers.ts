import type { Page } from "@playwright/test";
export async function openMap(page: Page, opts: { width: number; height?: number; scheme?: "light" | "dark"; net?: boolean; noWebGL?: boolean; path?: string }) {
  await page.setViewportSize({ width: opts.width, height: opts.height ?? 844 });
  await page.emulateMedia({ colorScheme: opts.scheme ?? "light", reducedMotion: "reduce" });
  // Externe Kacheln/APIs blocken: deterministisch und offline-fähig.
  if (!opts.net) await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (opts.noWebGL) await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test stub
    HTMLCanvasElement.prototype.getContext = function (t: string, ...a: unknown[]) { return /webgl/.test(t) ? null : orig.call(this, t, ...a); };
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  if (process.env.BL_SKIP_LANDING) await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await page.goto(opts.path ?? "/");
  await page.locator('[data-chrome="map"]').waitFor({ timeout: 15000 });
  await page.locator(".leaflet-container").waitFor();
  await page.waitForTimeout(400);
}
