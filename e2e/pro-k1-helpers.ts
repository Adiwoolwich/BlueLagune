import { expect, type Page } from "@playwright/test";
import { openMap } from "./helpers";

export const k1Path = (q = "eu") => `/?pro=${q}&lat=50.94&lng=6.96&z=12&design=teal&konzept=1`;
export type Box = { x: number; y: number; width: number; height: number };
export const overlap = (a: Box, b: Box) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

export async function openK1(page: Page, opts: { width: number; height?: number; scheme?: "light" | "dark"; q?: string } ) {
  await page.addInitScript(() => { localStorage.setItem("bl-skip-landing", "1"); sessionStorage.setItem("bl-sat-preview-later", "1"); });
  await openMap(page, { width: opts.width, height: opts.height ?? (opts.width > 1000 ? 800 : 844), scheme: opts.scheme, path: k1Path(opts.q) });
  await expect(page.locator("[data-k1-tabbar]")).toBeAttached();
}
export async function dragMap(page: Page) {
  const box = (await page.locator(".leaflet-container").boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy + 60, { steps: 6 });
  await page.mouse.up();
}
