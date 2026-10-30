import { chromium } from "@playwright/test";
const [,, base, outDir, tag] = process.argv;
const shots = JSON.parse(process.env.SHOTS);
const b = await chromium.launch();
for (const s of shots) {
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr ?? 1, colorScheme: s.scheme ?? "light", isMobile: s.w < 800, hasTouch: s.w < 800 });
  const p = await ctx.newPage();
  await p.addInitScript((st) => { localStorage.setItem("bl-skip-landing", "1"); if (st) { const k = Object.keys(localStorage); } }, s.sat);
  await p.goto(base + (s.path ?? "/"), { waitUntil: "load" }).catch(() => {});
  await p.locator(".leaflet-container").waitFor({ timeout: 15000 });
  if (s.sat) { await p.locator(s.satSel).first().click().catch(() => {}); }
  if (s.peek) { await p.evaluate(() => {}); }
  await p.waitForTimeout(s.wait ?? 3500);
  await p.screenshot({ path: `${outDir}/${s.name}${tag ? "-" + tag : ""}.png` });
  console.log("ok", s.name);
  await ctx.close();
}
await b.close();
