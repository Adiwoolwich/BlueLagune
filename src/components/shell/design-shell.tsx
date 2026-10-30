import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Flag, Layers, List, Satellite, Share2, Star, X } from "lucide-react";
import { MapHost } from "../map-host";
import { LocateButton, SearchAndFilters, SearchBar, StationPanel } from "../station-panel";
import { OfflineButton, OfflineNotice } from "../offline-panel";
import { GoogleMapsButton } from "../google-maps-button";
import { StatusBadge } from "../status-badge";
import { allStations, useAppStore, type Filters, type MapView } from "../../lib/store";
import { centerOfBounds, formatKm, haversineKm, inBounds } from "../../lib/geo";
import { hasPreciseCoords, type Station } from "../../lib/stations";
import { copyShareUrl, shareUrl } from "../../lib/url-state";
import { postReport } from "../../lib/reports";
import { feeLabel, t, typeLabel, useLang } from "../../lib/i18n";
import { cn } from "../../lib/utils";

/*
 * Gerüst für ?design=* (Supercharger-Stil): Such-Pill, Chip-Leiste, Standort-FAB,
 * Karussell großer Stationskarten, Detailkarte, Desktop-Seitenpanel.
 * Farben ausschließlich über --bl-*-Tokens (design.css, Abschnitt „Gerüst“), damit nacht/sand ohne Umbau greifen.
 */

type Lang = "de" | "en" | "nl";
const TXT: Record<string, Record<Lang, string>> = {
  layers: { de: "Ebenen", en: "Layers", nl: "Lagen" },
  sat: { de: "Satellit", en: "Satellite", nl: "Satelliet" },
  list: { de: "Liste", en: "List", nl: "Lijst" },
  offline: { de: "Offline", en: "Offline", nl: "Offline" },
  all: { de: "Alle {n} Stationen", en: "All {n} stations", nl: "Alle {n} stations" },
  close: { de: "Schließen", en: "Close", nl: "Sluiten" },
  drive: { de: "Fahrzeit", en: "Drive", nl: "Rijtijd" },
  dist: { de: "Entfernung", en: "Distance", nl: "Afstand" },
  report: { de: "Melden", en: "Report", nl: "Melden" },
  works: { de: "Funktioniert", en: "Works", nl: "Werkt" },
  broken: { de: "Defekt", en: "Broken", nl: "Defect" },
  thanks: { de: "Danke für die Meldung", en: "Thanks for reporting", nl: "Bedankt voor de melding" },
  more: { de: "Alle Details", en: "All details", nl: "Alle details" },
  copied: { de: "Link kopiert", en: "Link copied", nl: "Link gekopieerd" },
  radius: { de: "Umkreis", en: "Radius", nl: "Straal" },
  free: { de: "Gratis", en: "Free", nl: "Gratis" },
  empty: { de: "Keine Station im Ausschnitt", en: "No station in view", nl: "Geen station in beeld" },
  save: { de: "Merken", en: "Save", nl: "Bewaren" },
};
function tx(k: keyof typeof TXT, lang: string, n?: number): string {
  const v = TXT[k][(lang as Lang) in TXT[k] ? (lang as Lang) : "de"];
  return n == null ? v : v.replace("{n}", String(n));
}

const RADIUS_CYCLE = [5, 10, 20, 50, 100];

function useDesktop(): boolean {
  const q = "(min-width: 1024px)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return on;
}

function useOrigin() {
  const userPos = useAppStore((s) => s.userPos);
  const bounds = useAppStore((s) => s.bounds);
  return userPos ?? (bounds ? centerOfBounds(bounds) : null);
}

/** Grobe Fahrzeit: Luftlinie × 1,3 bei Ø 60 km/h (Schätzung, kein Routing). */
function driveMin(km: number): string {
  const min = Math.max(1, Math.round(((km * 1.3) / 60) * 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

function Badges({ s }: { s: Station }) {
  return (
    <span className="bl-g-badges">
      {s.hours === "24h" ? <span className="bl-g-badge bl-g-badge-warm">24h</span> : null}
      {s.fee ? <span className="bl-g-badge">{feeLabel(s.fee)}</span> : null}
      <span className="bl-g-badge">{typeLabel(s.type)}</span>
    </span>
  );
}

/* ---------- Such-Pill + Ebenen ---------- */
function SearchPill({ onLayers }: { onLayers: () => void }) {
  const lang = useLang();
  return (
    <div data-bl-search className="bl-g-pill">
      <div className="min-w-0 flex-1">
        <SearchBar overlay noRadius />
      </div>
      <button type="button" className="bl-g-icon" aria-label={tx("layers", lang)} title={tx("layers", lang)} onClick={onLayers} data-bl-layers>
        <Layers className="size-5" />
      </button>
    </div>
  );
}

function LayersMenu({ onClose, onList, offlineOpen }: { onClose: () => void; onList: () => void; offlineOpen?: boolean }) {
  const lang = useLang();
  const mapStyle = useAppStore((s) => s.mapStyle);
  const setMapStyle = useAppStore((s) => s.setMapStyle);
  const mapLabels = useAppStore((s) => s.mapLabels);
  const setMapLabels = useAppStore((s) => s.setMapLabels);
  return (
    <div className="bl-g-scrim" role="dialog" aria-modal="true" aria-label={tx("layers", lang)} onClick={onClose}>
      <div className="bl-g-menu" onClick={(e) => e.stopPropagation()}>
        <div className="bl-g-menu-head">
          <p className="bl-g-title-sm">{tx("layers", lang)}</p>
          <button type="button" className="bl-g-icon" aria-label={tx("close", lang)} onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <button
          type="button"
          className="bl-g-menu-row"
          aria-pressed={mapStyle === "sat"}
          onClick={() => {
            if (mapStyle === "sat") setMapStyle("map");
            else {
              setMapStyle("sat");
              if (!mapLabels) setMapLabels(true);
            }
          }}
        >
          <Satellite className="size-5" /> <span>{tx("sat", lang)}</span>
        </button>
        <button type="button" className="bl-g-menu-row" onClick={onList}>
          <List className="size-5" /> <span>{tx("list", lang)}</span>
        </button>
        <OfflineButton label={tx("offline", lang)} className="bl-g-menu-row" openOnMount={offlineOpen} />
      </div>
    </div>
  );
}

/* ---------- Chip-Leiste ---------- */
function ChipBar() {
  const lang = useLang();
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const chips: { key: keyof Filters; label: string }[] = [
    { key: "cassette", label: t("chipCassette") },
    { key: "greywater", label: t("chipGrey") },
    { key: "h24", label: t("chip24") },
    { key: "feeFree", label: tx("free", lang) },
  ];
  const r = filters.radiusKm;
  const nextR = RADIUS_CYCLE[(RADIUS_CYCLE.indexOf(r) + 1) % RADIUS_CYCLE.length] ?? 20;
  return (
    <div className="bl-g-chips" data-bl-chips>
      <button type="button" className="bl-g-chip" aria-pressed={r > 0} aria-label={`${tx("radius", lang)} ${r} km`} onClick={() => setFilters({ radiusKm: nextR })}>
        {r > 0 ? `${r} km` : t("radiusPlace")}
      </button>
      {chips.map((c) => (
        <button key={c.key} type="button" className="bl-g-chip" aria-pressed={Boolean(filters[c.key])} onClick={() => setFilters({ [c.key]: !filters[c.key] })}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Karussell ---------- */
function useNearby(stations: Station[]) {
  const origin = useOrigin();
  const bounds = useAppStore((s) => s.bounds);
  return useMemo(() => {
    const inView = stations.filter((s) => hasPreciseCoords(s) && (!bounds || inBounds(s, bounds)));
    const list = origin ? [...inView].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b)) : inView;
    return { list: list.slice(0, 30), total: inView.length, origin };
  }, [stations, origin, bounds]);
}

function Carousel({ stations, onList }: { stations: Station[]; onList: () => void }) {
  const lang = useLang();
  const { list, total, origin } = useNearby(stations);
  const focusId = useAppStore((s) => s.focusId);
  const setFocus = useAppStore((s) => s.setFocus);
  const select = useAppStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const fromScroll = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Pin getippt → Karte ins Bild scrollen
  useEffect(() => {
    if (!focusId || fromScroll.current === focusId) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(focusId)}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [focusId]);

  function onScroll() {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const box = ref.current;
      if (!box) return;
      const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
      let best: string | null = null;
      let d = Infinity;
      for (const c of Array.from(box.querySelectorAll<HTMLElement>("[data-card]"))) {
        const r = c.getBoundingClientRect();
        const dd = Math.abs(r.left + r.width / 2 - mid);
        if (dd < d) {
          d = dd;
          best = c.dataset.card ?? null;
        }
      }
      if (best && best !== useAppStore.getState().focusId) {
        fromScroll.current = best;
        setFocus(best);
      }
    }, 140);
  }

  return (
    <section
      className="bl-g-bottom"
      data-bl-carousel
      aria-label={t("nearbyStations")}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const dy = e.changedTouches[0].clientY - s.y;
        if (dy < -48 && Math.abs(dy) > Math.abs(dx) * 1.4) onList();
      }}
    >
      <button type="button" className="bl-g-grab" onClick={onList} aria-label={tx("all", lang, total)}>
        <span className="bl-g-grab-bar" aria-hidden />
        <span className="bl-g-grab-text">{tx("all", lang, total)}</span>
      </button>
      {list.length === 0 ? (
        <p className="bl-g-card bl-g-empty">{tx("empty", lang)}</p>
      ) : (
        <div ref={ref} className="bl-g-carousel" onScroll={onScroll}>
          {list.map((s) => {
            const km = origin ? haversineKm(origin, s) : null;
            return (
              <button
                key={s.id}
                type="button"
                data-card={s.id}
                aria-current={focusId === s.id ? "true" : undefined}
                className="bl-g-card"
                onClick={() => {
                  setFocus(s.id);
                  select(s.id);
                }}
              >
                <span className="bl-g-card-main">
                  <span className="bl-g-card-name">{s.city}</span>
                  <span className="bl-g-card-sub">{s.address || s.name}</span>
                  <Badges s={s} />
                </span>
                {km != null ? (
                  <span className="bl-g-card-km">
                    <span className="bl-g-num">{formatKm(km).replace(/ (km|m)$/, "")}</span>
                    <span className="bl-g-unit">{formatKm(km).endsWith(" m") ? "m" : "km"}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Detailkarte ---------- */
function DetailCard({ station, onMore, inline }: { station: Station; onMore: () => void; inline?: boolean }) {
  const lang = useLang();
  const select = useAppStore((s) => s.select);
  const mapView = useAppStore((s) => s.mapView) as MapView;
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const reports = useAppStore((s) => s.reports);
  const serverReports = useAppStore((s) => s.serverReports);
  const upsert = useAppStore((s) => s.upsertServerReport);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const origin = useOrigin();
  const km = origin && hasPreciseCoords(station) ? haversineKm(origin, station) : null;
  const [reporting, setReporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fav = favorites.includes(station.id);

  async function share() {
    const url = shareUrl({ ...mapView, id: station.id, filters, query });
    try {
      if (navigator.share) {
        await navigator.share({ title: station.name, url });
        return;
      }
    } catch {
      /* weiter mit Kopieren */
    }
    if (await copyShareUrl()) setMsg(tx("copied", lang));
  }
  async function send(status: "ok" | "broken") {
    const res = await postReport(station.id, status, "");
    if (res.status === 429) return setMsg(t("reportRate"));
    if (!res.ok) return setMsg(t("reportErr"));
    upsert(station.id, res.report ?? { status, at: Date.now() });
    setReporting(false);
    setMsg(tx("thanks", lang));
  }

  return (
    <section className={cn("bl-g-detail", inline && "bl-g-detail-inline")} data-bl-detail aria-label={station.name}>
      <div className="bl-g-detail-head">
        <div className="min-w-0">
          <p className="bl-g-kicker">{typeLabel(station.type)}</p>
          <h2 className="bl-g-title">{station.name}</h2>
          <p className="bl-g-card-sub">{[station.address, [station.postalCode, station.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
        </div>
        <div className="bl-g-detail-actions">
          <button type="button" className="bl-g-icon" aria-pressed={fav} aria-label={tx("save", lang)} onClick={() => toggleFavorite(station.id)}>
            <Star className={cn("size-5", fav && "bl-g-fill")} />
          </button>
          <button type="button" className="bl-g-icon" aria-label={tx("close", lang)} onClick={() => select(null)}>
            <X className="size-5" />
          </button>
        </div>
      </div>
      {km != null ? (
        <div className="bl-g-stats">
          <div>
            <p className="bl-g-num-lg">{formatKm(km)}</p>
            <p className="bl-g-stat-label">{tx("dist", lang)}</p>
          </div>
          <div>
            <p className="bl-g-num-lg">≈ {driveMin(km)}</p>
            <p className="bl-g-stat-label">{tx("drive", lang)}</p>
          </div>
        </div>
      ) : null}
      <div className="bl-g-badge-row">
        <StatusBadge station={station} report={reports[station.id]} />
        <Badges s={station} />
      </div>
      <GoogleMapsButton lat={station.lat} lng={station.lng} label={station.name} address={station.address} city={station.city} postalCode={station.postalCode} />
      {reporting ? (
        <div className="bl-g-two">
          <button type="button" className="bl-g-btn" onClick={() => void send("ok")}>{tx("works", lang)}</button>
          <button type="button" className="bl-g-btn bl-g-btn-bad" onClick={() => void send("broken")}>{tx("broken", lang)}</button>
        </div>
      ) : (
        <div className="bl-g-two">
          <button type="button" className="bl-g-btn" onClick={() => void share()}>
            <Share2 className="size-4" /> {t("share")}
          </button>
          <button type="button" className="bl-g-btn" onClick={() => setReporting(true)}>
            <Flag className="size-4" /> {tx("report", lang)}
          </button>
        </div>
      )}
      {msg ? <p role="status" className="bl-g-msg">{msg}</p> : null}
      {serverReports[station.id]?.note ? <p className="bl-g-card-sub">„{serverReports[station.id]?.note}“</p> : null}
      <button type="button" className="bl-g-link" onClick={onMore}>{tx("more", lang)}</button>
    </section>
  );
}

/* ---------- Volle Liste (mobil) ---------- */
function ListOverlay({ stations, count, onClose }: { stations: Station[]; count: number; onClose: () => void }) {
  const lang = useLang();
  const start = useRef<number | null>(null);
  return (
    <section className="bl-g-list" data-bl-list aria-label={t("nearbyStations")}>
      <div
        className="bl-g-list-head"
        onTouchStart={(e) => (start.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (start.current != null && e.changedTouches[0].clientY - start.current > 60) onClose();
          start.current = null;
        }}
      >
        <p className="bl-g-title-sm">{t("nearbyStations")}</p>
        <button type="button" className="bl-g-icon" aria-label={tx("close", lang)} onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      <div className="bl-g-list-body">
        <SearchAndFilters count={count} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <StationPanel stations={stations} />
        </div>
      </div>
    </section>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="relative h-dvh overflow-hidden bg-bg text-fg bl-g" data-chrome="map">{children}</div>;
}

export function DesignShell({ stations, initial, inViewCount, offlineOpen }: { stations: Station[]; initial: MapView & { id?: string | null }; inViewCount: number; offlineOpen?: boolean }) {
  useLang();
  const desktop = useDesktop();
  const panel = useAppStore((s) => s.panel);
  const selectedId = useAppStore((s) => s.selectedId);
  const extra = useAppStore((s) => s.extraStations);
  const setPanel = useAppStore((s) => s.setPanel);
  const selected = selectedId ? allStations(extra).find((s) => s.id === selectedId) : undefined;
  const [layers, setLayers] = useState(false);
  const [list, setList] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.shell = "g";
    return () => {
      delete document.documentElement.dataset.shell;
    };
  }, []);
  useEffect(() => setMore(false), [selectedId]);

  const detail = panel === "detail" && selected && !more ? selected : null;
  const top = (
    <>
      <SearchPill onLayers={() => setLayers(true)} />
      <ChipBar />
    </>
  );

  return (
    <Frame>
      <section className="sr-only">
        <h1>{t("srTitle")}</h1>
        <p>{t("srLead")}</p>
      </section>
      <main className="absolute inset-0">
        <MapHost stations={stations} initialView={initial} />
        <div className="bl-map-fade" aria-hidden />
      </main>

      {desktop ? (
        <aside className="bl-g-side" data-bl-side>
          {top}
          <OfflineNotice />
          {detail ? (
            <DetailCard station={detail} inline onMore={() => setMore(true)} />
          ) : (
            <div className="bl-g-side-body">
              {panel === "list" ? <SearchAndFilters count={inViewCount} /> : null}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <StationPanel stations={stations} />
              </div>
            </div>
          )}
        </aside>
      ) : (
        <>
          <div className="bl-g-top" data-bl-keep-clear>
            {top}
            <OfflineNotice />
          </div>
          {list || more ? (
            <ListOverlay
              stations={stations}
              count={inViewCount}
              onClose={() => {
                setList(false);
                setMore(false);
                if (panel !== "detail") setPanel("list");
              }}
            />
          ) : detail ? (
            <DetailCard station={detail} onMore={() => setMore(true)} />
          ) : (
            <>
              <div className="bl-g-fab" data-bl-fab>
                <LocateButton floating />
              </div>
              <Carousel stations={stations} onList={() => setList(true)} />
            </>
          )}
        </>
      )}
      {desktop ? (
        <div className="bl-g-fab bl-g-fab-desk" data-bl-fab>
          <LocateButton floating />
        </div>
      ) : null}
      {layers ? (
        <LayersMenu
          offlineOpen={offlineOpen}
          onClose={() => setLayers(false)}
          onList={() => {
            setLayers(false);
            setPanel("list");
            setList(true);
          }}
        />
      ) : null}
    </Frame>
  );
}
