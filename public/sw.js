/* Blue Lagune service worker: app shell + map tiles for offline use. */
const APP = "bl-app-v2";
const TILES = "bl-tiles-v4";
const TILE_HOSTS = [
  "server.arcgisonline.com",
  "services.arcgisonline.com",
  "clarity.maptiles.arcgis.com",
  "tiles.openfreemap.org",
  "basemaps.cartocdn.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP).then((cache) => cache.addAll(["/", "/index.html", "/favicon.svg"]).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== APP && k !== TILES).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
    event.respondWith(tileResponse(req));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(appResponse(req));
  }
});

async function tileResponse(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) {
      cache.put(req, res.clone()).catch(() => undefined);
    }
    return res;
  } catch {
    const again = await cache.match(req);
    if (again) return again;
    return new Response("", { status: 504, statusText: "offline" });
  }
}

function isAsset(url) {
  return /\.(js|css|png|jpe?g|svg|ico|webp|woff2?|json|map)$/i.test(url.pathname);
}

async function appResponse(req) {
  const cache = await caches.open(APP);
  const url = new URL(req.url);
  try {
    const res = await fetch(req);
    if (res.ok && (req.mode === "navigate" || isAsset(url))) {
      cache.put(req, res.clone()).catch(() => undefined);
      if (req.mode === "navigate") {
        cache.put("/", res.clone()).catch(() => undefined);
        cache.put("/index.html", res.clone()).catch(() => undefined);
      }
    }
    return res;
  } catch {
    const hit =
      (await cache.match(req)) ||
      (req.mode === "navigate" ? (await cache.match("/")) || (await cache.match("/index.html")) : undefined);
    if (hit) return hit;
    return new Response("Offline", { status: 504, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
