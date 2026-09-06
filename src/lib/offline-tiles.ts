import type { MapBounds } from "./geo";
import type { MapView } from "./store";

export const TILE_CACHE = "bl-tiles-v4";
export const OFFLINE_META_KEY = "bl-offline-meta";
const MAX_TILES = 2400;
const Z_MIN = 7;
const Z_MAX = 15;

export type OfflineMeta = {
  at: number;
  tiles: number;
  label: string;
  zoom: number;
};

export type SaveKind = "view" | 25 | 50;

function lon2x(lon: number, z: number) {
  const n = 2 ** z;
  let x = Math.floor(((lon + 180) / 360) * n);
  if (x < 0) x = 0;
  if (x >= n) x = n - 1;
  return x;
}

function lat2y(lat: number, z: number) {
  const n = 2 ** z;
  const rad = (Math.min(85.05, Math.max(-85.05, lat)) * Math.PI) / 180;
  let y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  if (y < 0) y = 0;
  if (y >= n) y = n - 1;
  return y;
}

export function imageryUrl(z: number, x: number, y: number) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

export function roadsUrl(z: number, x: number, y: number) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`;
}

/** The stable wildcard path is also used by SAT_LABEL_STYLE. */
export function labelsUrl(z: number, x: number, y: number) {
  return `https://tiles.openfreemap.org/planet/bluelagune/${z}/${x}/${y}.pbf`;
}

export function boundsFromView(view: MapView): MapBounds {
  const span = 360 / 2 ** Math.max(1, view.zoom);
  return {
    west: view.lng - span,
    east: view.lng + span,
    south: view.lat - span * 0.55,
    north: view.lat + span * 0.55,
  };
}

export function boundsFromRadius(lat: number, lng: number, km: number): MapBounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    west: lng - dLng,
    east: lng + dLng,
    south: lat - dLat,
    north: lat + dLat,
  };
}

function urlsForBounds(bounds: MapBounds, zMin: number, zMax: number, cap: number): string[] {
  const urls: string[] = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2x(bounds.west, z);
    const x1 = lon2x(bounds.east, z);
    const y0 = lat2y(bounds.north, z);
    const y1 = lat2y(bounds.south, z);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        urls.push(imageryUrl(z, x, y), roadsUrl(z, x, y));
        // OpenFreeMap serves labels through z14; MapLibre overscales that level above it.
        if (z <= 14) urls.push(labelsUrl(z, x, y));
        if (urls.length >= cap) return urls;
      }
    }
  }
  return urls;
}

export function planDownload(
  bounds: MapBounds,
  zoom: number,
): { urls: string[]; zMin: number; zMax: number } {
  const z0 = Math.round(zoom);
  let zMin = Math.max(Z_MIN, Math.min(z0 - 1, Z_MAX));
  let zMax = Math.min(Z_MAX, Math.max(z0 + 2, zMin + 1));
  let urls = urlsForBounds(bounds, zMin, zMax, MAX_TILES + 1);
  while (urls.length > MAX_TILES && zMax > zMin) {
    zMax -= 1;
    urls = urlsForBounds(bounds, zMin, zMax, MAX_TILES + 1);
  }
  if (urls.length > MAX_TILES) urls = urls.slice(0, MAX_TILES);
  return { urls, zMin, zMax };
}

export function estimateMb(tileCount: number) {
  return Math.max(1, Math.round((tileCount * 22) / 1024));
}

export function readMeta(): OfflineMeta | null {
  try {
    const raw = localStorage.getItem(OFFLINE_META_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as OfflineMeta;
    if (!v || typeof v.tiles !== "number") return null;
    return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeMeta(meta: OfflineMeta | null) {
  try {
    if (!meta) localStorage.removeItem(OFFLINE_META_KEY);
    else localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export async function cacheAvailable(): Promise<boolean> {
  if (typeof caches === "undefined" || typeof caches.open !== "function") return false;
  try {
    const cache = await caches.open(TILE_CACHE);
    return Boolean(cache);
  } catch {
    return false;
  }
}

export async function saveTiles(
  urls: string[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ saved: number; failed: number }> {
  const cache = await caches.open(TILE_CACHE);
  let saved = 0;
  let failed = 0;
  let done = 0;
  const total = urls.length;
  const workers = 6;
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      if (signal?.aborted) return;
      const url = urls[i++]!;
      try {
        const res = await fetch(url, { mode: "no-cors", credentials: "omit", signal, cache: "reload" });
        await cache.put(url, res);
        saved += 1;
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  if (signal?.aborted) {
    throw new DOMException("Offline map save cancelled", "AbortError");
  }
  if (saved === 0 && failed > 0) {
    throw new Error("No map tiles could be saved");
  }
  return { saved, failed };
}

export async function clearTiles() {
  if (typeof caches !== "undefined") await caches.delete(TILE_CACHE);
  writeMeta(null);
}

export async function countCached(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  try {
    const cache = await caches.open(TILE_CACHE);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export function rememberSave(meta: OfflineMeta) {
  writeMeta(meta);
}

export async function storageLabel(): Promise<string | null> {
  try {
    if (typeof navigator === "undefined") return null;
    const est = await navigator.storage?.estimate?.();
    if (!est?.usage) return null;
    const mb = est.usage / (1024 * 1024);
    if (mb < 1) return `${Math.round(est.usage / 1024)} kB`;
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  } catch {
    return null;
  }
}
