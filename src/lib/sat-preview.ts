import { useSyncExternalStore } from "react";
import { ESRI_API_KEY, SAT_SOURCES, satTileUrl } from "./sat-source";

/**
 * Satelliten-Vorschau (2×2 Kacheln) für Stationskarten.
 * - SAT_PREVIEW: abschaltbar per VITE_SAT_PREVIEW=0.
 * - Mock-Pflicht: solange VITE_SAT_MOCK nicht ausdrücklich "0" ist, werden NUR lokale Platzhalter (/mock-sat/) geladen.
 * - Echt (später): Esri World Imagery aus SAT_SOURCES, Key kommt ausschließlich aus der Umgebung (ESRI_API_KEY → __ESRI_API_KEY__).
 * - Einwilligung nur im Speicher (kein localStorage), kein Cache (fetch cache:"no-store", SW überspringt /mock-sat/ und Esri-Hosts).
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const SAT_PREVIEW: boolean = env.VITE_SAT_PREVIEW !== "0";
export const SAT_PREVIEW_MOCK: boolean = env.VITE_SAT_MOCK !== "0";
export const SAT_PREVIEW_ZOOM = 17;
export const SAT_PREVIEW_ATTRIBUTION = "Esri, Maxar, Earthstar Geographics";

export type PreviewTile = { x: number; y: number; z: number; left: number; top: number; url: string | null };
export type PreviewGrid = { tiles: PreviewTile[]; offX: number; offY: number };

export function worldPx(lat: number, lng: number, z: number) {
  const n = 256 * 2 ** z;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

/** Kachel-URL: Mock → lokaler Platzhalter; echt → Esri-Vorlage mit Key aus der Umgebung, ohne Key null (→ Vektor-Miniatur). */
export function previewTileUrl(z: number, x: number, y: number, opts: { mock?: boolean; key?: string } = {}): string | null {
  const mock = opts.mock ?? SAT_PREVIEW_MOCK;
  if (mock) return `/mock-sat/mock-${(x & 1) + (y & 1) * 2}.svg`;
  const tpl = satTileUrl(SAT_SOURCES["esri-imagery"], opts.key ?? ESRI_API_KEY);
  if (!tpl) return null;
  return tpl.replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}

/** 2×2-Raster, das die Station enthält; offX/offY = Lage der Station im 512×512-Raster (128…384). */
export function previewGrid(lat: number, lng: number, z = SAT_PREVIEW_ZOOM, opts?: { mock?: boolean; key?: string }): PreviewGrid {
  const p = worldPx(lat, lng, z);
  const tx0 = Math.floor(p.x / 256 - 0.5);
  const ty0 = Math.floor(p.y / 256 - 0.5);
  const tiles: PreviewTile[] = [];
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++)
      tiles.push({ x: tx0 + dx, y: ty0 + dy, z, left: dx * 256, top: dy * 256, url: previewTileUrl(z, tx0 + dx, ty0 + dy, opts) });
  return { tiles, offX: p.x - tx0 * 256, offY: p.y - ty0 * 256 };
}

/* Einwilligung: nur im Speicher, gilt bis Neuladen. */
let consent = false;
const subs = new Set<() => void>();
export function grantSatConsent() {
  consent = true;
  subs.forEach((f) => f());
}
export function resetSatConsent() {
  consent = false;
  subs.forEach((f) => f());
}
export function useSatConsent(): boolean {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => consent,
    () => false,
  );
}
