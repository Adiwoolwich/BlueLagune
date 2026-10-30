import { useSyncExternalStore } from "react";
import { ESRI_API_KEY, SAT_SOURCES, satTileUrl } from "./sat-source";

/**
 * Satelliten-Vorschau (2×2 Kacheln) für Stationskarten.
 * - SAT_PREVIEW: abschaltbar per VITE_SAT_PREVIEW=0.
 * - Mock-Pflicht: solange VITE_SAT_MOCK nicht ausdrücklich "0" ist, werden NUR lokale Platzhalter (/mock-sat/) geladen.
 * - Echt (später): Esri World Imagery aus SAT_SOURCES, Key kommt ausschließlich aus der Umgebung (ESRI_API_KEY → __ESRI_API_KEY__).
 * - Einwilligung siehe unten; Laden erst danach, lazy nur für sichtbare Karten (IntersectionObserver).
 * - Nur normaler Browser-Cache: kein Prefetch, kein Server-/SW-/Offline-Cache (SW überspringt /mock-sat/ und Esri-Hosts).
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const SAT_PREVIEW: boolean = env.VITE_SAT_PREVIEW !== "0";
export const SAT_PREVIEW_MOCK: boolean = env.VITE_SAT_MOCK !== "0";
export const SAT_PREVIEW_ZOOM = 17;
export const SAT_PREVIEW_ATTRIBUTION = "Esri, Maxar, Earthstar Geographics";
export const SAT_PREVIEW_POWERED = "Powered by Esri";

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

/* Einwilligung (Lex, 30.10.2026): einmalige Abfrage mit [Erlauben]/[Nicht jetzt], nichts vorausgewählt.
 * Erlauben → localStorage „yes“. Nicht jetzt → nur sessionStorage-Sperre (nächste Sitzung oder Klick auf den Platzhalter fragt erneut).
 * Widerruf unter „Datenschutz“ → „Satellitenvorschau“. Dasselbe Gate gilt für die Satellitenansicht der Karte (sat-source.ts unverändert). */
export const SAT_CONSENT_KEY = "bl-sat-preview";
export const SAT_LATER_KEY = "bl-sat-preview-later";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const ls = (): Store | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
const ss = (): Store | null => { try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; } };

type State = { allowed: boolean; later: boolean; open: boolean };
let state: State = { allowed: false, later: false, open: false };
let pending: (() => void) | null = null;
const subs = new Set<() => void>();
function emit(next: Partial<State>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
/** Zustand aus dem Gerätespeicher lesen (beim Start und in Tests). */
export function loadSatConsent() {
  state = { allowed: ls()?.getItem(SAT_CONSENT_KEY) === "yes", later: ss()?.getItem(SAT_LATER_KEY) === "1", open: false };
  subs.forEach((f) => f());
}
loadSatConsent();

/** Darf überhaupt etwas von Esri (bzw. im Mock vom Platzhalter) geladen werden? */
export const satAllowed = () => state.allowed;
/** Soll die Abfrage gerade sichtbar sein? */
export const satAskVisible = () => !state.allowed && (state.open || !state.later);

export function allowSat() {
  try { ls()?.setItem(SAT_CONSENT_KEY, "yes"); } catch { /* nur Sitzung */ }
  emit({ allowed: true, open: false });
  const p = pending;
  pending = null;
  p?.();
}
export function notNowSat() {
  try { ss()?.setItem(SAT_LATER_KEY, "1"); } catch { /* ignorieren */ }
  pending = null;
  emit({ later: true, open: false });
}
/** Widerruf (Menü „Datenschutz“ → „Satellitenvorschau“): danach wird nichts mehr geladen. */
export function revokeSat() {
  try { ls()?.removeItem(SAT_CONSENT_KEY); ss()?.setItem(SAT_LATER_KEY, "1"); } catch { /* ignorieren */ }
  emit({ allowed: false, later: true, open: false });
}
/** Abfrage erneut öffnen (Klick auf Platzhalter oder Satellit-Ebene); onAllow läuft nach „Erlauben“. */
export function askSat(onAllow?: () => void) {
  if (state.allowed) return void onAllow?.();
  pending = onAllow ?? null;
  emit({ open: true });
}
/** Gate vor der Satellitenansicht der Karte. */
export function withSatConsent(action: () => void) {
  askSat(action);
}
export function useSatConsent(): State {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => state,
  );
}

/** Nur DE/EN (User 30.10.2026 12:42: Niederländisch raus); nl fällt auf EN zurück. */
type L2 = { de: string; en: string };
export const l2 = (v: L2, lang: string) => (lang === "de" ? v.de : v.en);
export const SAT_ASK: { q: L2; body: L2; allow: L2; notNow: L2 } = {
  q: {"de": "Satellitenvorschau anzeigen?", "en": "Show satellite previews?"},
  body: {"de": "Die Vorschaubilder auf den Stationskarten lädt dein Browser direkt von Esri (Environmental Systems Research Institute, Inc., USA). Dabei wird deine IP-Adresse an Esri in die USA übertragen. Zweck: Anzeige der Satellitenbilder sowie Abrechnung und Missbrauchsschutz bei Esri. Deine Wahl speichern wir nur auf deinem Gerät. Du kannst sie jederzeit unter „Datenschutz“ → „Satellitenvorschau“ widerrufen.", "en": "Your browser loads the preview images on the station cards directly from Esri (Environmental Systems Research Institute, Inc., USA). This transmits your IP address to Esri in the USA. Purpose: displaying the satellite images, plus billing and abuse protection at Esri. We store your choice only on your device. You can withdraw it at any time under \"Privacy\" → \"Satellite preview\"."},
  allow: {"de": "Erlauben", "en": "Allow"},
  notNow: {"de": "Nicht jetzt", "en": "Not now"},
};
