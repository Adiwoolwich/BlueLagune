import { MAP_CENTER } from "./stations";
import { defaultFilters, type Filters } from "./store";

export type UrlView = {
  lat: number;
  lng: number;
  zoom: number;
  id: string | null;
  filters: Partial<Filters>;
  query?: string;
};

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function flag(p: URLSearchParams, key: string): boolean | undefined {
  if (!p.has(key)) return undefined;
  return p.get(key) === "1" || p.get(key) === "true";
}

export function hasMapDeepLink(search = typeof window === "undefined" ? "" : window.location.search): boolean {
  const p = new URLSearchParams(search);
  return p.has("lat") || p.has("lng") || p.has("z") || p.has("id") || p.has("q") || p.has("c") || p.has("s");
}

export function parseUrl(search = typeof window === "undefined" ? "" : window.location.search): UrlView {
  const p = new URLSearchParams(search);
  const c = p.get("c");
  let lat = num(p.get("lat"));
  let lng = num(p.get("lng"));
  if ((lat == null || lng == null) && c) {
    const [a, b] = c.split(",");
    lat = num(a ?? null);
    lng = num(b ?? null);
  }
  lat = lat ?? MAP_CENTER.lat;
  lng = lng ?? MAP_CENTER.lng;
  const zoom = num(p.get("z")) ?? 6;
  const id = p.get("id")?.trim() || p.get("s")?.trim() || null;
  const query = p.get("q")?.trim() || undefined;
  const filters: Partial<Filters> = {};
  const cas = flag(p, "cas");
  const camp = flag(p, "camp");
  const cc = flag(p, "cc");
  const gw = flag(p, "gw");
  const fw = flag(p, "fw");
  const free = flag(p, "free");
  const paid = flag(p, "paid");
  const guest = flag(p, "guest");
  const open = flag(p, "open");
  const h24 = flag(p, "h24");
  const hose = flag(p, "hose");
  const conf = flag(p, "ok");
  const cde = flag(p, "de");
  const cnl = flag(p, "nl");
  if (cas != null) filters.cassette = cas;
  if (camp != null) filters.campsite = camp;
  if (cc != null) filters.camperclean = cc;
  if (gw != null) filters.greywater = gw;
  if (fw != null) filters.freshwater = fw;
  if (free != null) filters.feeFree = free;
  if (paid != null) filters.feePaid = paid;
  if (guest != null) filters.feeGuest = guest;
  if (open != null) filters.openNow = open;
  if (h24 != null) filters.h24 = h24;
  if (hose != null) filters.hose = hose;
  if (conf != null) filters.confirmed = conf;
  if (cde != null) filters.countryDe = cde;
  if (cnl != null) filters.countryNl = cnl;
  const r = num(p.get("r"));
  if (r != null) filters.radiusKm = r;
  if (query) filters.place = query;
  return {
    lat: Math.min(55.2, Math.max(47.2, lat)),
    lng: Math.min(15.1, Math.max(3.2, lng)),
    zoom: Math.min(18, Math.max(4, zoom)),
    id,
    filters,
    query,
  };
}

function setFlag(p: URLSearchParams, key: string, value: boolean, def: boolean) {
  if (value !== def) p.set(key, value ? "1" : "0");
}

export function buildSearchParams(view: {
  lat: number;
  lng: number;
  zoom: number;
  id?: string | null;
  filters: Filters;
  query?: string;
}): string {
  const p = new URLSearchParams();
  p.set("c", `${view.lat.toFixed(5)},${view.lng.toFixed(5)}`);
  p.set("z", String(Math.round(view.zoom * 10) / 10));
  if (view.id) p.set("id", view.id);
  const f = view.filters;
  const d = defaultFilters;
  setFlag(p, "cas", f.cassette, d.cassette);
  setFlag(p, "camp", f.campsite, d.campsite);
  setFlag(p, "cc", f.camperclean, d.camperclean);
  setFlag(p, "gw", f.greywater, d.greywater);
  setFlag(p, "fw", f.freshwater, d.freshwater);
  setFlag(p, "free", f.feeFree, d.feeFree);
  setFlag(p, "paid", f.feePaid, d.feePaid);
  setFlag(p, "guest", f.feeGuest, d.feeGuest);
  setFlag(p, "open", f.openNow, d.openNow);
  setFlag(p, "h24", f.h24, d.h24);
  setFlag(p, "hose", f.hose, d.hose);
  setFlag(p, "ok", f.confirmed, d.confirmed);
  setFlag(p, "de", f.countryDe, d.countryDe);
  setFlag(p, "nl", f.countryNl, d.countryNl);
  if (f.radiusKm !== d.radiusKm) p.set("r", String(f.radiusKm));
  const q = (view.query ?? f.place).trim();
  if (q) p.set("q", q);
  return p.toString();
}

export function replaceUrl(view: {
  lat: number;
  lng: number;
  zoom: number;
  id?: string | null;
  filters: Filters;
  query?: string;
}) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/") return;
  const qs = buildSearchParams(view);
  // Oberflächenwahl (alt/design/konzept) beim Umschreiben behalten, sonst springt ein Reload auf den Standard.
  const cur = new URLSearchParams(window.location.search);
  const keep = new URLSearchParams();
  for (const k of ["alt", "design", "konzept"]) { const v = cur.get(k); if (v !== null) keep.set(k, v); }
  const ks = keep.toString();
  const all = ks ? (qs ? `${ks}&${qs}` : ks) : qs;
  const next = `/?${all}`;
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.replaceState(null, "", next);
}

export function shareUrl(view: {
  lat: number;
  lng: number;
  zoom: number;
  id?: string | null;
  filters: Filters;
  query?: string;
}): string {
  const qs = buildSearchParams(view);
  // Oberflächenwahl (alt/design/konzept) beim Umschreiben behalten, sonst springt ein Reload auf den Standard.
  const cur = new URLSearchParams(window.location.search);
  const keep = new URLSearchParams();
  for (const k of ["alt", "design", "konzept"]) { const v = cur.get(k); if (v !== null) keep.set(k, v); }
  const ks = keep.toString();
  const all = ks ? (qs ? `${ks}&${qs}` : ks) : qs;
  if (typeof window === "undefined") return `https://blue-lagune.com/?${qs}`;
  return `${window.location.origin}/?${qs}`;
}

export async function copyShareUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    try {
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      return true;
    } catch {
      return false;
    }
  }
}
