import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Globe, List, Loader2, LocateFixed, Plus, Share2, SlidersHorizontal, Star, X } from "lucide-react";
import { CitySelect } from "./city-select";
import { GoogleMapsButton } from "./google-maps-button";
import { AddStationForm } from "./add-station-form";
import { OfflineButton } from "./offline-panel";
import { HoursTable } from "./hours-table";
import { StatusBadge, STATUS_COLOR } from "./status-badge";
import { alongRouteKm, centerOfBounds, formatKm, haversineKm, inBounds } from "../lib/geo";
import { reverseNominatim } from "../lib/nominatim";
import { downloadGpx, downloadStationGpx } from "../lib/gpx";
import { fetchDrivingRoute } from "../lib/osrm";
import { canNavigateTo, deriveStatus, findCity, hasPreciseCoords, isHttpPhotoUrl, type Station } from "../lib/stations";
import {
  allStations,
  CORRIDOR_OPTIONS,
  RADIUS_OPTIONS,
  serverToLocal,
  stationCountry,
  useAppStore,
  type Filters,
} from "../lib/store";
import { copyShareUrl, shareUrl } from "../lib/url-state";
import { postReport } from "../lib/reports";
import { feeLabel, hoursLine, t, typeLabel, useLang } from "../lib/i18n";
import { cn } from "../lib/utils";

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "bl-tap inline-flex h-11 min-h-11 shrink-0 items-center rounded-full px-2.5 text-[13px] font-medium",
        active ? "bg-primary text-primary-fg" : "bg-surface text-fg ring-1 ring-border hover:ring-border-strong",
      )}
    >
      {children}
    </button>
  );
}

export function StationPanel({ stations }: { stations: Station[] }) {
  const panel = useAppStore((s) => s.panel);
  const selectedId = useAppStore((s) => s.selectedId);
  const extra = useAppStore((s) => s.extraStations);
  const selected = allStations(extra).find((s) => s.id === selectedId);
  let body: React.ReactNode;
  if (panel === "add") body = <AddStationForm />;
  else if (panel === "detail" && selected) body = <Detail station={selected} />;
  else if (panel === "saved") body = <SavedList />;
  else if (panel === "route") body = <RoutePlanner />;
  else body = <StationList stations={stations} />;
  return <div className="flex h-full min-h-0 flex-1 flex-col">{body}</div>;
}

export function SearchBar({ overlay }: { overlay?: boolean }) {
  useLang();
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const setUserPos = useAppStore((s) => s.setUserPos);
  const userPos = useAppStore((s) => s.userPos);
  const mapView = useAppStore((s) => s.mapView);
  const mapGesture = useAppStore((s) => s.mapGesture);
  const hasOrigin = Boolean(findCity(query) || findCity(filters.place) || userPos);
  const [reverseLabel, setReverseLabel] = useState("");
  const [pillCleared, setPillCleared] = useState(true);
  const lastMapGesture = useRef(mapGesture);
  useEffect(() => {
    if (!overlay || pillCleared) return;
    const { lat, lng, zoom } = mapView;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void reverseNominatim(lat, lng, zoom).then((label) => {
        if (!alive || !label) return;
        setReverseLabel(label);
      });
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [overlay, pillCleared, mapView.lat, mapView.lng, mapView.zoom]);

  useEffect(() => {
    if (!overlay || mapGesture === lastMapGesture.current) return;
    lastMapGesture.current = mapGesture;
    setPillCleared(false);
  }, [overlay, mapGesture]);

  useEffect(() => {
    if (!overlay || !userPos) return;
    setPillCleared(false);
  }, [overlay, userPos]);

  const pillValue =
    filters.place || query || (overlay && !pillCleared ? reverseLabel : "");

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <CitySelect
          value={pillValue}
          onChange={(place) => {
            setQuery(place);
            setFilters({ place });
            if (place.trim()) {
              setUserPos(null);
              setPillCleared(false);
            } else {
              setPillCleared(true);
            }
          }}
          placeholder={t("placePh")}
          warnUnmatched={false}
          compactMenu={overlay}
        />
      </div>
      <label
        className={
          overlay
            ? "relative block w-[4.2rem] shrink-0 self-center"
            : "relative block w-[4.6rem] shrink-0 self-end"
        }
      >
        <span className="sr-only">{t("radius")}</span>
        <select
          value={filters.radiusKm}
          disabled={!hasOrigin}
          onChange={(e) => setFilters({ radiusKm: Number(e.target.value) })}
          className={
            overlay
              ? "h-11 w-full appearance-none rounded-[10px] bg-black/80 py-0 pr-6 pl-2 text-[13px] text-white ring-1 ring-white/15 outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              : "h-11 w-full appearance-none rounded-full bg-surface py-0 pr-6 pl-2 text-sm text-fg ring-1 ring-border outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          }
          aria-label={t("radius")}
        >
          {RADIUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === 0 ? t("radiusPlace") : o.label}
            </option>
          ))}
        </select>
        <span
          className={
            overlay
              ? "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 border-x-4 border-t-[5px] border-x-transparent border-t-white/70"
              : "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 border-x-4 border-t-[5px] border-x-transparent border-t-muted"
          }
        />
      </label>
    </div>
  );
}

const CHIP_KEYS: {
  key: keyof Filters;
  label:
    | "chipCassette"
    | "chipGrey"
    | "chipFresh"
    | "chipFree"
    | "chipPaid"
    | "chipGuest"
    | "chipOpen"
    | "chip24"
    | "chipCamp"
    | "chipCc"
    | "chipHose"
    | "chipOk"
    | "chipDe"
    | "chipNl";
  aria:
    | "ariaCassette"
    | "ariaGrey"
    | "ariaFresh"
    | "ariaFree"
    | "ariaPaid"
    | "ariaGuest"
    | "ariaOpen"
    | "aria24"
    | "ariaCamp"
    | "ariaCc"
    | "ariaHose"
    | "ariaOk"
    | "ariaDe"
    | "ariaNl";
}[] = [
  { key: "cassette", label: "chipCassette", aria: "ariaCassette" },
  { key: "countryDe", label: "chipDe", aria: "ariaDe" },
  { key: "countryNl", label: "chipNl", aria: "ariaNl" },
  { key: "greywater", label: "chipGrey", aria: "ariaGrey" },
  { key: "freshwater", label: "chipFresh", aria: "ariaFresh" },
  { key: "feeFree", label: "chipFree", aria: "ariaFree" },
  { key: "feePaid", label: "chipPaid", aria: "ariaPaid" },
  { key: "feeGuest", label: "chipGuest", aria: "ariaGuest" },
  { key: "openNow", label: "chipOpen", aria: "ariaOpen" },
  { key: "h24", label: "chip24", aria: "aria24" },
  { key: "campsite", label: "chipCamp", aria: "ariaCamp" },
  { key: "camperclean", label: "chipCc", aria: "ariaCc" },
  { key: "hose", label: "chipHose", aria: "ariaHose" },
  { key: "confirmed", label: "chipOk", aria: "ariaOk" },
];

export function FilterChips() {
  useLang();
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CHIP_KEYS.map((c) => (
        <Chip
          key={c.key}
          active={Boolean(filters[c.key])}
          onClick={() => setFilters({ [c.key]: !filters[c.key] })}
          label={t(c.aria)}
        >
          {t(c.label)}
        </Chip>
      ))}
      <button
        type="button"
        onClick={resetFilters}
        className="inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs text-muted ring-1 ring-border hover:text-fg"
      >
        {t("reset")}
      </button>
    </div>
  );
}

export function ListToolbar({ count }: { count: number }) {
  useLang();
  const setPanel = useAppStore((s) => s.setPanel);
  const panel = useAppStore((s) => s.panel);
  const route = useAppStore((s) => s.route);
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted">
      <span className="tabular-nums">{t("inView", { n: count })}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPanel(panel === "route" ? "list" : "route")}
          className={cn("h-9 px-2 hover:text-fg", (panel === "route" || route) && "text-primary")}
        >
          {t("route")}
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "saved" ? "list" : "saved")}
          className={cn("h-9 px-2 hover:text-fg", panel === "saved" && "text-primary")}
        >
          {t("saved")}
        </button>
        <button
          type="button"
          onClick={() => setPanel("add")}
          className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg"
          aria-label={t("addPlace")}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SearchAndFilters({
  count,
  compact,
  embedSearch,
}: {
  count: number;
  compact?: boolean;
  embedSearch?: boolean;
}) {
  useLang();
  const setSheet = useAppStore((s) => s.setSheet);
  const setPanel = useAppStore((s) => s.setPanel);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const listSort = useAppStore((s) => s.listSort);
  const setListSort = useAppStore((s) => s.setListSort);
  const filtersOpen = useAppStore((s) => s.filtersOpen);
  const setFiltersOpen = useAppStore((s) => s.setFiltersOpen);
  const routePath = useAppStore((s) => s.routePath);
  return (
    <div className="shrink-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-[17px] font-semibold tracking-tight">{t("nearbyStations")}</h2>
        <button
          type="button"
          onClick={() => setSheet(compact ? "mid" : "peek")}
          className="bl-tap inline-flex size-11 items-center justify-center text-fg"
          aria-label={t("close")}
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            "bl-tap inline-flex size-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/15",
            filtersOpen ? "bg-surface-2" : "bg-transparent",
          )}
          aria-label={t("filterToggle")}
        >
          <SlidersHorizontal className="size-4" />
        </button>
        <label className="relative shrink-0">
          <span className="sr-only">{t("sortBy")}</span>
          <select
            value={listSort}
            onChange={(e) => setListSort(e.target.value as "distance" | "name" | "verified" | "along")}
            className="bl-tap h-11 appearance-none rounded-lg bg-transparent py-0 pr-6 pl-2.5 text-[13px] text-fg ring-1 ring-white/15"
          >
            <option value="distance">{t("sortBy")}</option>
            <option value="name">{t("sortName")}</option>
            <option value="verified">{t("sortVerified")}</option>
            <option value="along" disabled={!routePath?.coords.length}>{t("alongRoute")}</option>
          </select>
        </label>
        <Chip active={filters.cassette} onClick={() => setFilters({ cassette: !filters.cassette })} label={t("ariaCassette")}>
          {t("chipCassette")}
        </Chip>
        <Chip active={filters.greywater} onClick={() => setFilters({ greywater: !filters.greywater })} label={t("ariaGrey")}>
          {t("chipGreyShort")}
        </Chip>
      </div>
      {filtersOpen || embedSearch ? (
        <>
          <div className={embedSearch ? "block" : "hidden md:block"}>
            {embedSearch ? <SearchBar /> : null}
          </div>
          <FilterChips />
          <ListToolbar count={count} />
        </>
      ) : null}
      {compact ? (
        <button type="button" onClick={() => setPanel("add")} className="sr-only">
          {t("addPlace")}
        </button>
      ) : null}
    </div>
  );
}

function StationList({ stations }: { stations: Station[] }) {
  useLang();
  const userPos = useAppStore((s) => s.userPos);
  const select = useAppStore((s) => s.select);
  const selectedId = useAppStore((s) => s.selectedId);
  const favorites = useAppStore((s) => s.favorites);
  const bounds = useAppStore((s) => s.bounds);
  const listSort = useAppStore((s) => s.listSort);
  const routePath = useAppStore((s) => s.routePath);
  const reports = useAppStore((s) => s.reports);
  const serverReports = useAppStore((s) => s.serverReports);
  const origin = userPos ?? (bounds ? centerOfBounds(bounds) : null);
  const visible = useMemo(() => {
    const inView = bounds
      ? stations.filter((s) => hasPreciseCoords(s) && inBounds(s, bounds))
      : stations.filter(hasPreciseCoords);
    return [...inView].sort((a, b) => {
      if (listSort === "name") return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
      if (listSort === "verified") return b.lastVerified.localeCompare(a.lastVerified);
      if (listSort === "along" && routePath?.coords.length) {
        return alongRouteKm(a, routePath.coords) - alongRouteKm(b, routePath.coords);
      }
      if (origin) return haversineKm(origin, a) - haversineKm(origin, b);
      return a.name.localeCompare(b.name);
    });
  }, [stations, origin, bounds, listSort, routePath]);

  if (visible.length === 0) {
    const filterEmpty = stations.length === 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted">
        <p className="text-sm">{t(filterEmpty ? "emptyFilter" : "emptyView")}</p>
        <p className="text-xs">{t(filterEmpty ? "emptyFilterHint" : "emptyHint")}</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="bl-scroll divide-y divide-white/10">
        {visible.map((s) => {
          const km = origin && hasPreciseCoords(s) ? haversineKm(origin, s) : null;
          const fav = favorites.includes(s.id);
          const pin = STATUS_COLOR[deriveStatus(s, serverToLocal(s.id, serverReports[s.id], reports[s.id]))] ?? "#e11d2e";
          return (
            <li key={s.id} className="bl-list-row">
              <button
                type="button"
                onClick={() => select(s.id)}
                className={cn(
                  "bl-tap-row flex min-h-[72px] w-full items-center gap-3 py-3 text-left",
                  selectedId === s.id ? "bg-white/5" : "",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-semibold leading-tight text-fg">
                      {s.city}, {stationCountry(s) === "nl" ? t("countryNL") : t("countryDE")}
                    </span>
                    {fav ? <Star className="size-3.5 shrink-0 fill-white text-white" /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] leading-snug text-muted">{s.address || s.name}</p>
                  <p className="truncate text-[12px] leading-snug text-muted">
                    {[s.fee ? feeLabel(s.fee) : null, typeLabel(s.type), s.hours === "24h" ? "24h" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1">
                  <svg viewBox="0 0 24 32" width="36" height="40" aria-hidden>
                    <path fill={pin} stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" d="M12 1.5C12 1.5 3.5 12.2 3.5 19.2a8.5 8.5 0 0 0 17 0C20.5 12.2 12 1.5 12 1.5z" />
                    <circle cx="12" cy="19.2" r="3.2" fill="#ffffff" />
                  </svg>
                  {km != null ? <span className="text-[15px] font-semibold tabular-nums leading-none text-fg">{formatKm(km)}</span> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SavedList() {
  useLang();
  const favorites = useAppStore((s) => s.favorites);
  const recent = useAppStore((s) => s.recent);
  const extra = useAppStore((s) => s.extraStations);
  const select = useAppStore((s) => s.select);
  const setPanel = useAppStore((s) => s.setPanel);
  const all = allStations(extra);
  const saved = all.filter((s) => favorites.includes(s.id));
  const last = recent
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Station => Boolean(s))
    .slice(0, 8);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div data-bl-keep-clear className="sticky top-0 z-20 -mx-1 mb-2 bg-bg-elevated px-1 pb-1">
        <button type="button" onClick={() => setPanel("list")} className="inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-fg">
          {t("backList")}
        </button>
        <h2 className="mt-1 text-lg font-semibold">{t("saved")}</h2>
      </div>
      <div className="bl-scroll">
        {saved.length === 0 ? (
          <p className="text-sm text-muted">{t("savedEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {saved.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => select(s.id)} className="flex w-full items-center justify-between py-3 text-left">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted">{s.city}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {last.length ? (
          <>
            <h3 className="mt-6 mb-2 text-sm font-medium text-muted">{t("recently")}</h3>
            <ul className="divide-y divide-border/50">
              {last.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => select(s.id)} className="flex w-full items-center justify-between py-3 text-left">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted">{s.city}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RoutePlanner() {
  useLang();
  const setPanel = useAppStore((s) => s.setPanel);
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const setRoutePath = useAppStore((s) => s.setRoutePath);
  const routePath = useAppStore((s) => s.routePath);
  const corridorKm = useAppStore((s) => s.corridorKm);
  const setCorridorKm = useAppStore((s) => s.setCorridorKm);
  const [from, setFrom] = useState(route?.from ?? "");
  const [to, setTo] = useState(route?.to ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setError("");
    const a = findCity(from);
    const b = findCity(to);
    if (!from.trim() || !to.trim()) {
      setRoute(null);
      setRoutePath(null);
      setPanel("list");
      return;
    }
    if (!a || !b) {
      setError(t("routeNeedCities"));
      return;
    }
    setBusy(true);
    setRoute({ from: from.trim(), to: to.trim() });
    try {
      const path = await fetchDrivingRoute(from.trim(), to.trim(), a, b);
      setRoutePath(path);
      setPanel("list");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div data-bl-keep-clear className="sticky top-0 z-20 bg-bg-elevated pb-1">
        <button type="button" onClick={() => setPanel("list")} className="inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-fg">
          {t("backList")}
        </button>
        <h2 className="text-lg font-semibold">{t("route")}</h2>
      </div>
      <p className="text-sm text-muted">{t("routeLead")}</p>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{t("from")}</span>
        <CitySelect value={from} onChange={setFrom} placeholder={t("startPlace")} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{t("to")}</span>
        <CitySelect value={to} onChange={setTo} placeholder={t("endPlace")} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{t("corridor")}</span>
        <select
          value={corridorKm}
          onChange={(e) => setCorridorKm(Number(e.target.value))}
          className="h-11 w-full rounded-xl bg-surface px-3 text-sm ring-1 ring-border outline-none"
        >
          {CORRIDOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {routePath?.source === "straight" ? (
        <p className="rounded-xl bg-stale/10 px-3 py-2 text-sm text-stale">{t("routeAir")}</p>
      ) : null}
      {routePath?.source === "osrm" ? (
        <p className="text-sm text-muted">
          {t("routeKmMin", { km: Math.round(routePath.distanceKm), min: routePath.durationMin })}
        </p>
      ) : null}
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void apply()}
        className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-fg disabled:opacity-60"
      >
        {busy ? t("routeBusy") : t("routeApply")}
      </button>
      {route ? (
        <button
          type="button"
          onClick={() => {
            setRoute(null);
            setRoutePath(null);
            setPanel("list");
          }}
          className="h-11 rounded-xl text-sm text-muted ring-1 ring-border hover:text-fg"
        >
          {t("routeClear")}
        </button>
      ) : null}
    </div>
  );
}

function Detail({ station }: { station: Station }) {
  useLang();
  const reports = useAppStore((s) => s.reports);
  const extra = useAppStore((s) => s.extraStations);
  const serverReports = useAppStore((s) => s.serverReports);
  const upsertServerReport = useAppStore((s) => s.upsertServerReport);
  const notes = useAppStore((s) => s.notes);
  const setNote = useAppStore((s) => s.setNote);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const select = useAppStore((s) => s.select);
  const setPanel = useAppStore((s) => s.setPanel);
  const userPos = useAppStore((s) => s.userPos);
  const removeExtra = useAppStore((s) => s.removeExtraStation);
  const mapView = useAppStore((s) => s.mapView);
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const [noteDraft, setNoteDraft] = useState(notes[station.id] ?? "");
  const [publicNote, setPublicNote] = useState(serverReports[station.id]?.note ?? "");
  const [copied, setCopied] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const bounds = useAppStore((s) => s.bounds);
  const origin = userPos ?? (bounds ? centerOfBounds(bounds) : null);
  const km = origin && hasPreciseCoords(station) ? haversineKm(origin, station) : null;
  const fav = favorites.includes(station.id);
  const canDelete = extra.some((s) => s.id === station.id);
  const navOk = canNavigateTo(station);
  const live = serverReports[station.id];
  const photoOk = isHttpPhotoUrl(station.photoUrl);
  const hoursText = hoursLine(station);

  async function share() {
    const url = shareUrl({ ...mapView, id: station.id, filters, query });
    try {
      if (navigator.share) {
        await navigator.share({ title: station.name, url });
        return;
      }
    } catch {
      /* fall through */
    }
    const ok = await copyShareUrl();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function sendStatus(status: "ok" | "broken") {
    if (reportBusy) return;
    setReportBusy(true);
    setReportMsg(null);
    const res = await postReport(station.id, status, publicNote);
    setReportBusy(false);
    if (res.status === 429) {
      setReportMsg(t("reportRate"));
      return;
    }
    if (!res.ok) {
      setReportMsg(t("reportErr"));
      return;
    }
    const rec = res.report ?? { status, at: Date.now(), note: publicNote.trim() || undefined };
    upsertServerReport(station.id, rec);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div data-bl-keep-clear className="sticky top-0 z-20 mb-3 flex shrink-0 items-center justify-between gap-2 bg-bg-elevated">
        <button
          type="button"
          onClick={() => {
            select(null);
            setPanel("list");
          }}
          className="inline-flex h-11 items-center gap-1 text-sm text-muted hover:text-fg"
        >
          {t("back")}
        </button>
        <div className="flex gap-2">
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                removeExtra(station.id);
              }}
              className="inline-flex h-11 items-center rounded-xl bg-bad/12 px-3 text-sm text-bad ring-1 ring-border"
            >
              {t("delete")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => toggleFavorite(station.id)}
            className="inline-flex h-11 items-center gap-1 rounded-xl bg-surface px-3 text-sm ring-1 ring-border"
          >
            <Star className={cn("size-4", fav && "fill-primary text-primary")} />
            {fav ? t("savedYes") : t("save")}
          </button>
        </div>
      </div>
      <div className="bl-scroll space-y-4 pr-1">
        {photoOk ? (
          <img
            src={station.photoUrl}
            alt=""
            className="h-40 w-full rounded-xl object-cover"
          />
        ) : null}
        <header>
          <p className="text-xs tracking-wide text-muted uppercase">
            {station.state} · {typeLabel(station.type)}
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-semibold text-fg">{station.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {station.address}, {station.postalCode} {station.city}
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <StatusBadge station={station} report={serverToLocal(station.id, live, reports[station.id])} />
          {station.fee ? (
            <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-xs text-muted ring-1 ring-border">
              {feeLabel(station.fee)}
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-xs text-subtle ring-1 ring-border">
              {t("feeUnknown")}
            </span>
          )}
          {km != null ? (
            <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-xs text-muted tabular-nums ring-1 ring-border">
              {formatKm(km)}
            </span>
          ) : null}
        </div>
        <GoogleMapsButton
          lat={navOk && hasPreciseCoords(station) ? station.lat : undefined}
          lng={navOk && hasPreciseCoords(station) ? station.lng : undefined}
          label={station.name}
          address={station.address}
          city={station.city}
          postalCode={station.postalCode}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface text-sm ring-1 ring-border"
          >
            <Share2 className="size-4" />
            {copied ? t("linkCopied") : t("share")}
          </button>
          {hasPreciseCoords(station) ? (
            <button
              type="button"
              onClick={() => downloadStationGpx(station)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-surface text-sm ring-1 ring-border"
            >
              GPX
            </button>
          ) : null}
        </div>
        {station.hours === "seasonal" ? (
          <p className="rounded-lg bg-stale/10 px-3 py-2 text-xs text-stale">{t("seasonalWarn")}</p>
        ) : null}
        {hoursText || station.weeklyHours || station.hours === "24h" || station.hoursNote ? (
          <HoursTable station={station} />
        ) : (
          <p className="text-sm text-subtle">{t("hoursOpen")}: {t("hoursUnknown")}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              [t("chipCassette"), station.cassette],
              [t("chipGrey"), station.greywater],
              [t("chipFresh"), station.freshwater],
              [t("chipHose"), station.hose],
            ] as const
          ).map(([label, on]) => (
            <span
              key={label}
              className={cn("rounded-md px-2 py-1 text-xs", on ? "bg-ok/12 text-ok" : "bg-surface-2 text-subtle")}
            >
              {label}
            </span>
          ))}
        </div>
        {station.feeNote ? <p className="text-sm text-muted">{station.feeNote}</p> : null}
        {station.description ? <p className="text-sm leading-relaxed text-muted">{station.description}</p> : null}
        <section>
          <h3 className="mb-2 text-sm font-medium">{t("reportStatus")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["ok", t("geht"), false],
                ["broken", t("broken"), true],
              ] as const
            ).map(([kind, label, bad]) => {
              const selected = live?.status === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={reportBusy}
                  onClick={() => void sendStatus(kind)}
                  className={cn(
                    "h-11 rounded-xl text-sm font-medium ring-1 ring-border disabled:opacity-60",
                    selected
                      ? bad
                        ? "bg-bad text-fg"
                        : "bg-primary text-primary-fg"
                      : bad
                        ? "bg-bad/12 text-bad hover:bg-bad/22"
                        : "bg-surface text-fg hover:bg-surface-2",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {live?.note ? <p className="mt-2 text-xs text-muted">{live.note}</p> : null}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">{t("reportNote")}</span>
            <input
              value={publicNote}
              onChange={(e) => setPublicNote(e.target.value.slice(0, 200))}
              className="h-11 w-full rounded-xl bg-surface px-3 text-sm ring-1 ring-border outline-none"
              placeholder={t("reportNotePh")}
              maxLength={200}
            />
          </label>
          {reportMsg ? <p className="mt-2 text-sm text-bad">{reportMsg}</p> : null}
        </section>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t("note")}</span>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => setNote(station.id, noteDraft)}
            rows={3}
            className="w-full resize-none rounded-xl bg-surface p-3 text-sm ring-1 ring-border outline-none"
            placeholder={t("notePh")}
          />
        </label>
      </div>
    </div>
  );
}

export function LocateButton({ iconOnly, floating }: { iconOnly?: boolean; floating?: boolean }) {
  useLang();
  const setUserPos = useAppStore((s) => s.setUserPos);
  const setFilters = useAppStore((s) => s.setFilters);
  const setQuery = useAppStore((s) => s.setQuery);
  const [busy, setBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const geoTimer = useRef<number | null>(null);
  const geoAvailable = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
  useEffect(() => () => {
    if (geoTimer.current != null) window.clearTimeout(geoTimer.current);
  }, []);
  function showGeoMessage(message: string) {
    if (geoTimer.current != null) window.clearTimeout(geoTimer.current);
    setGeoMsg(message);
    geoTimer.current = window.setTimeout(() => setGeoMsg(""), 2800);
  }
  return (
    <div className="relative inline-flex">
      <button
      type="button"
      onClick={() => {
        if (busy) return;
        if (!geoAvailable) {
          showGeoMessage(t("errGeoOff"));
          return;
        }
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setFilters({ place: "" });
            setQuery("");
            setBusy(false);
          },
          () => {
            setBusy(false);
            showGeoMessage(t("errGeoFail"));
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }}
      data-bl-keep-clear
      className={cn(
        "bl-tap inline-flex items-center justify-center bg-black/80 text-white ring-1 ring-white/15",
        floating ? "size-11 shrink-0 rounded-full" : "h-11 shrink-0 rounded-full",
        iconOnly || floating ? "w-11" : "px-3",
      )}
      aria-label={t("locate")}
      aria-disabled={!geoAvailable}
      aria-busy={busy}
      title={!geoAvailable ? t("errGeoOff") : t("locate")}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" />
      ) : floating ? (
        <Compass className="size-5" />
      ) : (
        <LocateFixed className="size-5" />
      )}
      {iconOnly || floating ? null : <span className="ml-1.5 text-sm">{t("locate")}</span>}
    </button>
      {geoMsg ? (
        <span role="status" className="absolute top-full right-0 z-50 mt-2 w-max max-w-[15rem] rounded-lg bg-black/90 px-3 py-2 text-xs text-white shadow-lg">
          {geoMsg}
        </span>
      ) : null}
    </div>
  );
}

const fabCls = "bl-tap inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-black/80 text-white ring-1 ring-white/15";

export function ShareFab() {
  useLang();
  const mapView = useAppStore((s) => s.mapView);
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const selectedId = useAppStore((s) => s.selectedId);
  return (
    <button
      type="button"
      className={cn("pointer-events-auto", fabCls)}
      aria-label={t("shareMap")}
      onClick={() => {
        const url = shareUrl({ ...mapView, id: selectedId, filters, query });
        if (navigator.share) void navigator.share({ url, title: "Blue Lagune" }).catch(() => copyShareUrl());
        else void copyShareUrl();
      }}
    >
      <Share2 className="size-5" />
    </button>
  );
}

export function MapRoundButtons({ offlineOpen }: { offlineOpen?: boolean }) {
  useLang();
  const mapLabels = useAppStore((s) => s.mapLabels);
  const setMapLabels = useAppStore((s) => s.setMapLabels);
  const satClarity = useAppStore((s) => s.satClarity);
  const setSatClarity = useAppStore((s) => s.setSatClarity);
  const sheet = useAppStore((s) => s.sheet);
  const setSheet = useAppStore((s) => s.setSheet);
  const hold = useRef(0);
  const held = useRef(false);
  const clarityToastTimer = useRef<number | null>(null);
  const [clarityToast, setClarityToast] = useState(false);

  useEffect(() => () => {
    if (clarityToastTimer.current != null) window.clearTimeout(clarityToastTimer.current);
  }, []);

  function showClarityToast() {
    if (clarityToastTimer.current != null) window.clearTimeout(clarityToastTimer.current);
    setClarityToast(true);
    clarityToastTimer.current = window.setTimeout(() => setClarityToast(false), 1400);
  }
  return (
    <div className="relative flex flex-col gap-3">
      <LocateButton floating />
      <button
        type="button"
        className={cn(fabCls, "bg-white text-black ring-white/0")}
        aria-label={satClarity ? t("mapClarity") : t("mapLayers")}
        title={`${t("mapLayers")} · ${t("mapClarity")}`}
        aria-pressed={mapLabels}
        onPointerDown={() => {
          held.current = false;
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => {
            held.current = true;
            setSatClarity(!satClarity);
            showClarityToast();
          }, 480);
        }}
        onPointerUp={() => window.clearTimeout(hold.current)}
        onPointerCancel={() => window.clearTimeout(hold.current)}
        onPointerLeave={() => window.clearTimeout(hold.current)}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          setMapLabels(!mapLabels);
        }}
      >
        <Globe className="size-5" />
      </button>
      <button
        type="button"
        className={cn(fabCls, sheet !== "peek" && "bg-white text-black ring-white/0")}
        aria-label={t("nearbyStations")}
        aria-pressed={sheet !== "peek"}
        onClick={() => setSheet(sheet === "peek" ? "mid" : "peek")}
      >
        <List className="size-5" />
      </button>
      <OfflineButton floating openOnMount={offlineOpen} />
      {clarityToast ? (
        <span
          role="status"
          className="pointer-events-none absolute top-14 right-14 whitespace-nowrap rounded-lg bg-black/90 px-2.5 py-1.5 text-xs text-white shadow-lg"
        >
          {t("mapClarity")}
        </span>
      ) : null}
    </div>
  );
}
