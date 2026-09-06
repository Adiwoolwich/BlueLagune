import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deriveStatus,
  findCity,
  isOpenNow,
  STATIONS,
  type LocalReport,
  type Station,
} from "./stations";
import {
  distanceToPolylineKm,
  distanceToSegmentKm,
  haversineKm,
  type MapBounds,
} from "./geo";
import type { RoutePath } from "./osrm";

export type Filters = {
  cassette: boolean;
  camperclean: boolean;
  campsite: boolean;
  greywater: boolean;
  freshwater: boolean;
  feeFree: boolean;
  feePaid: boolean;
  feeGuest: boolean;
  countryDe: boolean;
  countryNl: boolean;
  openNow: boolean;
  h24: boolean;
  hose: boolean;
  confirmed: boolean;
  place: string;
  radiusKm: number;
};

export const RADIUS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Ort" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 20, label: "20 km" },
  { value: 30, label: "30 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
  { value: 150, label: "150 km" },
  { value: 200, label: "200 km" },
];

export const CORRIDOR_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 km" },
  { value: 25, label: "25 km" },
  { value: 40, label: "40 km" },
  { value: 60, label: "60 km" },
];

export const defaultFilters: Filters = {
  cassette: true,
  camperclean: false,
  campsite: false,
  greywater: false,
  freshwater: false,
  feeFree: false,
  feePaid: false,
  feeGuest: false,
  countryDe: true,
  countryNl: true,
  openNow: false,
  h24: false,
  hose: false,
  confirmed: false,
  place: "",
  radiusKm: 20,
};

type RouteEnds = { from: string; to: string } | null;

export type MapView = { lat: number; lng: number; zoom: number };

type AppState = {
  query: string;
  filters: Filters;
  selectedId: string | null;
  favorites: string[];
  recent: string[];
  reports: Record<string, LocalReport>;
  notes: Record<string, string>;
  userPos: { lat: number; lng: number } | null;
  route: RouteEnds;
  routePath: RoutePath | null;
  corridorKm: number;
  bounds: MapBounds | null;
  mapView: MapView;
  mapGesture: number;
  panel: "list" | "detail" | "saved" | "route" | "add";
  extraStations: Station[];
  sheet: "peek" | "mid" | "full";
  mapLabels: boolean;
  satClarity: boolean;
  listSort: "distance" | "name" | "verified" | "along";
  filtersOpen: boolean;
  serverReports: Record<string, ServerReport>;
  setQuery: (q: string) => void;
  setFilters: (p: Partial<Filters>) => void;
  resetFilters: () => void;
  select: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  setFavorites: (ids: string[]) => void;
  report: (r: LocalReport) => void;
  setNote: (id: string, note: string) => void;
  setUserPos: (pos: { lat: number; lng: number } | null) => void;
  setRoute: (r: RouteEnds) => void;
  setRoutePath: (p: RoutePath | null) => void;
  setCorridorKm: (km: number) => void;
  setBounds: (b: MapBounds | null) => void;
  setMapView: (v: MapView) => void;
  markMapGesture: () => void;
  setPanel: (p: AppState["panel"]) => void;
  setSheet: (s: AppState["sheet"]) => void;
  setMapLabels: (on: boolean) => void;
  setSatClarity: (on: boolean) => void;
  setListSort: (s: AppState["listSort"]) => void;
  setFiltersOpen: (on: boolean) => void;
  setExtraStations: (list: Station[]) => void;
  addStation: (station: Station) => void;
  removeExtraStation: (id: string) => void;
  setServerReports: (reports: Record<string, ServerReport>) => void;
  upsertServerReport: (id: string, report: ServerReport) => void;
};

export type ServerReport = { status: "ok" | "broken"; note?: string; at: number };

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      query: "",
      filters: defaultFilters,
      selectedId: null,
      favorites: [],
      recent: [],
      reports: {},
      notes: {},
      userPos: null,
      route: null,
      routePath: null,
      corridorKm: 25,
      bounds: null,
      mapView: { lat: 51.16, lng: 10.45, zoom: 6 },
      mapGesture: 0,
      panel: "list",
      extraStations: [],
      sheet: "mid",
      mapLabels: true,
      satClarity: false,
      listSort: "distance",
      filtersOpen: false,
      serverReports: {},
      setQuery: (query) => set({ query }),
      setFilters: (p) => set({ filters: { ...get().filters, ...p } }),
      resetFilters: () => set({ filters: defaultFilters }),
      select: (id) => {
        if (!id) {
          set({ selectedId: null, panel: "list" });
          return;
        }
        const recent = [id, ...get().recent.filter((x) => x !== id)].slice(0, 12);
        set({
          selectedId: id,
          recent,
          panel: "detail",
          sheet: "mid",
        });
      },
      toggleFavorite: (id) => {
        const favorites = get().favorites.includes(id)
          ? get().favorites.filter((x) => x !== id)
          : [id, ...get().favorites];
        set({ favorites });
      },
      setFavorites: (favorites) => set({ favorites }),
      report: (r) => set({ reports: { ...get().reports, [r.stationId]: r } }),
      setNote: (id, note) => set({ notes: { ...get().notes, [id]: note } }),
      setUserPos: (userPos) => set({ userPos }),
      setRoute: (route) => set({ route, routePath: route ? get().routePath : null }),
      setRoutePath: (routePath) => set({ routePath }),
      setCorridorKm: (corridorKm) => set({ corridorKm }),
      setBounds: (bounds) => set({ bounds }),
      setMapView: (mapView) => set({ mapView }),
      markMapGesture: () => set({ mapGesture: get().mapGesture + 1 }),
      setPanel: (panel) =>
        set({
          panel,
          sheet: "mid",
          selectedId: panel === "list" ? get().selectedId : get().selectedId,
        }),
      setSheet: (sheet) => set({ sheet }),
      setMapLabels: (mapLabels) => set({ mapLabels }),
      setSatClarity: (satClarity) => set({ satClarity }),
      setListSort: (listSort) => set({ listSort }),
      setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
      setExtraStations: (extraStations) => set({ extraStations }),
      addStation: (station) => {
        const list = get().extraStations.filter((s) => s.id !== station.id);
        set({
          extraStations: [station, ...list],
          selectedId: station.id,
          panel: "detail",
          sheet: "full",
        });
      },
      removeExtraStation: (id) => {
        set({
          extraStations: get().extraStations.filter((s) => s.id !== id),
          selectedId: get().selectedId === id ? null : get().selectedId,
          panel: get().selectedId === id ? "list" : get().panel,
        });
      },
      setServerReports: (serverReports) => set({ serverReports }),
      upsertServerReport: (id, report) =>
        set({ serverReports: { ...get().serverReports, [id]: report } }),
    }),
    {
      name: "blue-lagoon-v4",
      skipHydration: true,
      partialize: (s) => ({
        favorites: s.favorites,
        recent: s.recent,
        reports: s.reports,
        notes: s.notes,
        extraStations: s.extraStations,
      }),
    },
  ),
);

export function isCampsite(s: Station): boolean {
  if (s.campsite === true) return true;
  if (s.campsite === false) return false;
  const n = `${s.name} ${s.description ?? ""}`.toLowerCase();
  return n.includes("camping");
}

export const NL_STATES = new Set([
  "Noord-Holland",
  "Zuid-Holland",
  "Friesland",
  "Groningen",
  "Gelderland",
  "Utrecht",
  "Noord-Brabant",
  "Limburg",
  "Overijssel",
  "Zeeland",
  "Drenthe",
  "Flevoland",
]);

export const DE_STATES = new Set([
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
]);

export function stationCountry(s: Station): "de" | "nl" {
  if (NL_STATES.has(s.state)) return "nl";
  return "de";
}

/** Layer for the Kassette / Automat / Camping display toggles. */
export function stationLayer(s: Station): "campsite" | "automat" | "cassette" | null {
  if (s.type === "camperclean") return "automat";
  if (isCampsite(s)) return "campsite";
  if (s.cassette) return "cassette";
  return null;
}

export function allStations(extra: Station[] = []): Station[] {
  if (extra.length === 0) return STATIONS;
  const seen = new Set(STATIONS.map((s) => s.id));
  return [...STATIONS, ...extra.filter((s) => !seen.has(s.id))];
}

export function serverToLocal(
  id: string,
  server?: ServerReport,
  local?: LocalReport,
): LocalReport | undefined {
  if (server) {
    return { stationId: id, kind: server.status === "broken" ? "broken" : "ok", at: server.at, note: server.note };
  }
  return local;
}

export function applyFilters(
  list: Station[],
  state: Pick<AppState, "query" | "filters" | "reports" | "serverReports" | "userPos" | "route" | "routePath" | "corridorKm">,
  opts?: { now?: Date },
): Station[] {
  const now = opts?.now ?? new Date();
  const q = state.query.trim().toLowerCase();
  const f = state.filters;
  const routeA = state.route?.from ? findCity(state.route.from) : undefined;
  const routeB = state.route?.to ? findCity(state.route.to) : undefined;
  const place = findCity(state.query) ?? (f.place.trim() ? findCity(f.place) : undefined);
  const feeOn = f.feeFree || f.feePaid || f.feeGuest;
  const routed = Boolean(state.routePath?.coords.length || (routeA && routeB));

  return list.filter((s) => {
    if (q && !place) {
      const hay = `${s.name} ${s.city} ${s.postalCode} ${s.state} ${s.address}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const country = stationCountry(s);
    if (country === "de" && !f.countryDe) return false;
    if (country === "nl" && !f.countryNl) return false;
    const layer = stationLayer(s);
    if (layer === "campsite" && !f.campsite) return false;
    // CamperClean is an overlay: automats appear in addition to cassette dumps.
    if (layer === "automat" && !f.camperclean) return false;
    if (layer === "cassette" && !f.cassette) return false;
    // Greywater-only (cassette=false, layer null): hidden in default cassette view,
    // shown when the greywater chip is on.
    if (layer === null) {
      if (!(f.greywater && s.greywater)) return false;
    }
    if (f.freshwater && !s.freshwater) return false;
    if (feeOn) {
      const ok =
        (s.fee === "free" && f.feeFree) ||
        (s.fee === "paid" && f.feePaid) ||
        (s.fee === "guest" && f.feeGuest);
      if (!ok) return false;
    }
    if (f.hose && !s.hose) return false;
    if (f.h24 && s.hours !== "24h") return false;
    const report = serverToLocal(s.id, state.serverReports[s.id], state.reports[s.id]);
    if (f.openNow) {
      if (!isOpenNow(s, now) || deriveStatus(s, report) === "broken") {
        return false;
      }
    }
    if (f.confirmed && deriveStatus(s, report) !== "confirmed") {
      return false;
    }
    if (state.routePath && state.routePath.coords.length >= 2) {
      if (distanceToPolylineKm(s, state.routePath.coords) > state.corridorKm) return false;
    } else if (routeA && routeB) {
      if (distanceToSegmentKm(s, routeA, routeB) > state.corridorKm) return false;
    } else if (place) {
      if (f.radiusKm === 0) {
        const same = s.city.toLowerCase() === place.name.toLowerCase();
        if (!same && haversineKm(place, s) > 4) return false;
      } else if (haversineKm(place, s) > f.radiusKm) {
        return false;
      }
    } else if (state.userPos && f.radiusKm > 0 && !routed) {
      if (haversineKm(state.userPos, s) > f.radiusKm) return false;
    }
    return true;
  });
}

export function getStation(id: string | null, extra: Station[] = []): Station | undefined {
  if (!id) return undefined;
  return allStations(extra).find((s) => s.id === id);
}
