import { chromium } from "@playwright/test";
const base = process.argv[2], out = process.argv[3];
const b = await chromium.launch();
async function shot(name, w, fn) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 1000 ? 800 : 700 }, locale: "de-DE", serviceWorkers: "block" });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem("bl-skip-landing", "1"));
  await p.goto(base + "/?lat=50.94&lng=6.96&z=12", { waitUntil: "load" });
  await p.locator(".leaflet-container").waitFor(); await p.waitForTimeout(1500);
  await fn(p, ctx); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}.png` }); console.log("ok", name); await ctx.close();
}
const off = async (p, ctx) => { await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event("offline"))); };
const search = async (p) => { const i = p.locator("[data-bl-search] input").first(); await i.click(); await i.fill("Kö"); await p.getByRole("listbox").waitFor(); };
const sat = async (p) => { await p.locator("[data-bl-maptype]").click(); await p.waitForTimeout(2000); };
for (const w of [320, 390, 1280]) {
  await shot(`offline-${w}`, w, off);
  await shot(`suche-${w}`, w, search);
  await shot(`satellit-attr-${w}`, w, sat);
}
await shot("satellit-attr-320-info-offen", 320, async (p) => { await sat(p); await p.locator("[data-bl-attr-toggle]").click(); });
await b.close();
