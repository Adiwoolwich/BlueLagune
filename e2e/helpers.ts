import type { Page } from "@playwright/test";
export async function openMap(page: Page, opts: { width: number; height?: number; scheme?: "light" | "dark" }) {
  await page.setViewportSize({ width: opts.width, height: opts.height ?? 844 });
  await page.emulateMedia({ colorScheme: opts.scheme ?? "light", reducedMotion: "reduce" });
  // Externe Kacheln/APIs blocken: deterministisch und offline-fähig.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  if (process.env.BL_SKIP_LANDING) await page.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await page.goto("/");
  await page.locator('[data-chrome="map"]').waitFor({ timeout: 15000 });
  await page.locator(".leaflet-container").waitFor();
  await page.waitForTimeout(400);
}
