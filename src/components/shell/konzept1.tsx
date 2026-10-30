import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, Crown, Globe2, HelpCircle, Heart, Layers, List, Map as MapIcon, MapPin, MoreHorizontal, Navigation, Plus, Route, Satellite, Search, Share2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { MapHost } from "../map-host";
import { LocateButton, SearchBar, StationPanel } from "../station-panel";
import { OfflineButton, OfflineNotice } from "../offline-panel";
import { SatConsentPrompt } from "../sat-preview";
import { allStations, useAppStore, type Filters } from "../../lib/store";
import { formatKm, haversineKm, inBounds } from "../../lib/geo";
import { hasPreciseCoords, type Station } from "../../lib/stations";
import { copyShareUrl, shareUrl } from "../../lib/url-state";
import { plural, setLang, t, useLang, type Lang } from "../../lib/i18n";
import { SAT_PREVIEW, askSat, revokeSat, useSatConsent, withSatConsent } from "../../lib/sat-preview";
import { cn } from "../../lib/utils";
import { Carousel, DetailCard, useDesktop, useOrigin, type ShellProps } from "./design-shell";
import "../../theme/k1-tap.css";
import { K1ProContent, useK1ProChipSeen } from "../pro-k1";

/*
 * Konzept 1 (Tab-Bar): unten Karte · Liste · Favoriten · Pro · Mehr, oben eine große zentrale Suche.
 * Neu sortiert: Filter wohnen in der Suche (gruppiert), Ebenen sind ein Karten-Werkzeug (rechts an der Karte),
 * Offline/Sprache/Rechtliches/Einwilligungen sitzen unter „Mehr“. Nur --bl-*-Tokens.
 */

type Tab = "karte" | "liste" | "favoriten" | "pro" | "mehr";
/** Nur DE/EN (User 12:42: Niederländisch raus); nl fällt auf EN zurück. */
type L3 = { de: string; en: string; deOne?: string; enOne?: string };
const K: Record<string, L3> = {
  karte: { de: "Karte", en: "Map" },
  liste: { de: "Liste", en: "List" },
  favoriten: { de: "Favoriten", en: "Favourites" },
  pro: { de: "Pro", en: "Pro" },
  mehr: { de: "Mehr", en: "More" },
  searchPh: { de: "Ort, PLZ oder Station", en: "Place, postcode or station" },
  filter: { de: "Filter", en: "Filters" },
  recent: { de: "Zuletzt gesucht", en: "Recent searches" },
  clearRecent: { de: "Verlauf löschen", en: "Clear history" },
  removeRecent: { de: "„{q}“ aus dem Verlauf löschen", en: "Remove “{q}” from history" },
  nearTiles: { de: "In der Nähe", en: "Nearby" },
  near: { de: "In meiner Nähe", en: "Near me" },
  nearest: { de: "Route zur nächsten Station", en: "Route to nearest station" },
  radius: { de: "Umkreis", en: "Radius" },
  gEquip: { de: "Ver- und Entsorgung", en: "Facilities" },
  gTime: { de: "Zeit", en: "Time" },
  gCost: { de: "Kosten", en: "Cost" },
  gPlace: { de: "Ort & Qualität", en: "Place & quality" },
  sort: { de: "Sortierung", en: "Sort" },
  show: { de: "{n} Stationen zeigen", en: "Show {n} stations", deOne: "1 Station zeigen", enOne: "Show 1 station" },
  reset: { de: "Zurücksetzen", en: "Reset" },
  layers: { de: "Ebenen", en: "Layers" },
  map: { de: "Karte", en: "Map" },
  sat: { de: "Satellit", en: "Satellite" },
  clarity: { de: "Klarheit", en: "Clarity" },
  placeholder: { de: "Platzhalter", en: "Placeholder" },
  clarityNote: {
    de: "Klarheit ist ein Platzhalter: nur geschärfte Darstellung des normalen Satellitenbilds. Eine eigene Klarheit-Quelle folgt erst mit Key-Freigabe.",
    en: "Clarity is a placeholder: only a sharpened view of the normal satellite image. A dedicated clarity source follows once the key is approved.",
  },
  labels: { de: "Beschriftung", en: "Labels" },
  shareMap: { de: "Karte teilen", en: "Share map" },
  copied: { de: "Link kopiert", en: "Link copied" },
  close: { de: "Schließen", en: "Close" },
  secMap: { de: "Karte & Daten", en: "Map & data" },
  secApp: { de: "App", en: "App" },
  secLegal: { de: "Rechtliches", en: "Legal" },
  offline: { de: "Offline-Karten", en: "Offline maps" },
  route: { de: "Route planen", en: "Plan route" },
  add: { de: "Station hinzufügen", en: "Add station" },
  lang: { de: "Sprache", en: "Language" },
  secPrivacy: { de: "Datenschutz", en: "Privacy" },
  satPrev: { de: "Satellitenvorschau", en: "Satellite preview" },
  on: { de: "an", en: "on" },
  off: { de: "aus", en: "off" },
  revoke: { de: "Widerrufen", en: "Withdraw" },
  allow: { de: "Erlauben", en: "Allow" },
  guide: { de: "Anleitung", en: "Guide" },
  info: { de: "Über Blue Lagune", en: "About Blue Lagune" },
  imprint: { de: "Impressum", en: "Imprint" },
  privacy: { de: "Datenschutz", en: "Privacy" },
  feedback: { de: "Feedback", en: "Feedback" },
  attr: { de: "Karte © OpenStreetMap, OpenFreeMap · Satellit: Powered by Esri", en: "Map © OpenStreetMap, OpenFreeMap · Satellite: Powered by Esri" },
  proTitle: { de: "Pro Europa · Vorschau", en: "Pro Europe · preview" },
  proText: { de: "Status-Alarme für deine Route, ganz Europa, Offline-Pakete. Vorschau – nichts wird berechnet.", en: "Status alerts for your route, all of Europe, offline packs. Preview – nothing is charged." },
  nearby: { de: "Stationen im Kartenausschnitt", en: "Stations in view" },
  proChip: { de: "Pro", en: "Pro" },
};
const k = (key: keyof typeof K, lang: Lang, n?: number) => {
  const e = K[key];
  if (n == null) return lang === "de" ? e.de : e.en;
  return plural(n, (lang === "de" ? e.deOne : e.enOne) ?? (lang === "de" ? e.de : e.en), lang === "de" ? e.de : e.en, lang === "de" ? "de" : "en");
};

const GROUPS: { title: keyof typeof K; items: { key: keyof Filters; label: Parameters<typeof t>[0] }[] }[] = [
  { title: "gEquip", items: [{ key: "cassette", label: "chipCassette" }, { key: "greywater", label: "chipGrey" }, { key: "freshwater", label: "chipFresh" }, { key: "hose", label: "chipHose" }, { key: "camperclean", label: "chipCc" }] },
  { title: "gTime", items: [{ key: "openNow", label: "chipOpen" }, { key: "h24", label: "chip24" }] },
  { title: "gCost", items: [{ key: "feeFree", label: "chipFree" }, { key: "feePaid", label: "chipPaid" }, { key: "feeGuest", label: "chipGuest" }] },
  { title: "gPlace", items: [{ key: "countryDe", label: "chipDe" }, { key: "countryNl", label: "chipNl" }, { key: "campsite", label: "chipCamp" }, { key: "confirmed", label: "chipOk" }] },
];
const RADII = [0, 5, 10, 20, 50, 100];

function activeFilterCount(f: Filters): number {
  return GROUPS.flatMap((g) => g.items).filter((i) => f[i.key]).length + (f.radiusKm > 0 ? 1 : 0);
}

/* Zuletzt gesucht: Verlauf bleibt lokal im localStorage (bl-recent-q), geht nicht an Server/Pro-Metrik; Ortssuche-Text geht an OSM Nominatim (s. DSE privacyGeoP). */
/** Zuletzt gesucht – wie Konzept 2 (miniHard): gleicher Schlüssel bl-recent-q, max. 5, nur auf dem Gerät, löschbar. */
export const RECENT_KEY = "bl-recent-q";
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}
function useRecent() {
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  function remember(q: string) {
    const v = q.trim();
    if (v.length < 2) return;
    const next = [v, ...readRecent().filter((x) => x !== v)].slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* privat/voll */ }
    setRecent(next);
  }
  function remove(q: string) {
    const next = readRecent().filter((x) => x !== q);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* egal */ }
    setRecent(next);
  }
  function clear() {
    try { localStorage.removeItem(RECENT_KEY); } catch { /* egal */ }
    setRecent([]);
  }
  return { recent, remember, remove, clear };
}

/* ---------- Oben: große Suche ---------- */
function BigSearch({ onOpen }: { onOpen: () => void }) {
  const lang = useLang();
  const query = useAppStore((s) => s.query);
  const filters = useAppStore((s) => s.filters);
  const n = activeFilterCount(filters);
  return (
    <div className="k1-search" data-bl-search>
      <button type="button" className="k1-search-main" onClick={onOpen} data-k1-open-search>
        <Search className="size-5" />
        <span className={cn("k1-search-text", !query && "k1-muted")}>{query || filters.place || k("searchPh", lang)}</span>
      </button>
      <button type="button" className="k1-filter-btn" aria-label={`${k("filter", lang)}${n ? ` (${n})` : ""}`} onClick={onOpen}>
        <SlidersHorizontal className="size-5" />
        {n ? <span className="k1-count">{n}</span> : null}
      </button>
    </div>
  );
}

function SearchSheet({ stations, inView, recent, onClose: done }: { stations: Station[]; inView: number; recent: ReturnType<typeof useRecent>; onClose: () => void }) {
  const lang = useLang();
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const setQuery = useAppStore((s) => s.setQuery);
  const listSort = useAppStore((s) => s.listSort);
  const setListSort = useAppStore((s) => s.setListSort);
  const routePath = useAppStore((s) => s.routePath);
  const select = useAppStore((s) => s.select);
  const setFocus = useAppStore((s) => s.setFocus);
  const bounds = useAppStore((s) => s.bounds);
  const origin = useOrigin();
  const count = inView;
  const nearest = useMemo(() => {
    if (!origin) return null;
    let best: Station | null = null;
    let d = Infinity;
    for (const s of stations) {
      if (!hasPreciseCoords(s)) continue;
      const dd = haversineKm(origin, s);
      if (dd < d) (d = dd), (best = s);
    }
    return best;
  }, [stations, origin]);
  const placeOk = Boolean(filters.place || origin);
  const near = useMemo(() => {
    const ref = origin ?? null;
    if (!ref) return [] as Station[];
    return stations.filter(hasPreciseCoords).map((s) => [s, haversineKm(ref, s)] as const).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s]) => s);
  }, [stations, origin]);
  const onClose = () => {
    recent.remember(useAppStore.getState().query);
    done();
  };
  return (
    <section className="k1-sheet k1-sheet-search" role="dialog" aria-modal="true" aria-label={k("filter", lang)} data-k1-search>
      <div className="k1-sheet-head">
        <div className="min-w-0 flex-1">
          <SearchBar overlay noRadius />
        </div>
        <button type="button" className="bl-g-icon" aria-label={k("close", lang)} onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      <div className="k1-sheet-body">
        <div className="k1-quick">
          <div className="k1-quick-btn k1-quick-locate" data-k1-near>
            <LocateButton />
            <span className="k1-quick-label">{k("near", lang)}</span>
          </div>
          <button
            type="button"
            className="k1-quick-btn"
            disabled={!nearest}
            onClick={() => {
              if (!nearest) return;
              setFocus(nearest.id);
              select(nearest.id);
              onClose();
            }}
          >
            <Navigation className="size-5" />
            <span>{k("nearest", lang)}</span>
          </button>
        </div>
        {recent.recent.length ? (
          <div className="k1-group" data-k1-recent>
            <p className="k1-group-title k1-group-title-row">
              <span>{k("recent", lang)}</span>
              <button type="button" className="k1-link" onClick={recent.clear}>{k("clearRecent", lang)}</button>
            </p>
            <div className="k1-recent">
              {recent.recent.map((r) => (
                <span key={r} className="k1-chip-wrap" data-k1-recent-item>
                  <button type="button" className="k1-chip" onClick={() => setQuery(r)}>
                    <Clock className="size-4" aria-hidden /> {r}
                  </button>
                  <button type="button" className="k1-chip-x" aria-label={k("removeRecent", lang).replace("{q}", r)} onClick={() => recent.remove(r)} data-k1-recent-x>
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {near.length ? (
          <div className="k1-group" data-k1-neartiles>
            <p className="k1-group-title">{k("nearTiles", lang)}</p>
            <div className="k1-tiles">
              {near.map((s) => (
                <button key={s.id} type="button" className="k1-tile k1-tile-2" onClick={() => { setFocus(s.id); select(s.id); onClose(); }}>
                  <span>{s.city}</span>
                  <span className="k1-tile-sub">{origin ? formatKm(haversineKm(origin, s)) : ""}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="k1-group">
          <p className="k1-group-title">{k("radius", lang)}{!placeOk ? <span className="k1-hint"> · {t("radiusPlace")}</span> : null}</p>
          <div className="k1-seg" role="group" aria-label={k("radius", lang)}>
            {RADII.map((r) => (
              <button key={r} type="button" aria-pressed={filters.radiusKm === r} disabled={r > 0 && !placeOk} onClick={() => setFilters({ radiusKm: r })}>
                {r === 0 ? "–" : `${r} km`}
              </button>
            ))}
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="k1-group">
            <p className="k1-group-title">{k(g.title, lang)}</p>
            <div className="k1-tiles">
              {g.items.map((i) => (
                <button key={i.key} type="button" className="k1-tile" aria-pressed={Boolean(filters[i.key])} onClick={() => setFilters({ [i.key]: !filters[i.key] })}>
                  {t(i.label)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="k1-group">
          <p className="k1-group-title">{k("sort", lang)}</p>
          <div className="k1-seg" role="group" aria-label={k("sort", lang)}>
            {(["distance", "name", "verified", "along"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={listSort === s} disabled={s === "along" && !routePath?.coords.length} onClick={() => setListSort(s)}>
                {s === "distance" ? t("sortBy") : s === "name" ? t("sortName") : s === "verified" ? t("sortVerified") : t("alongRoute")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="k1-sheet-foot">
        <button type="button" className="bl-g-btn" onClick={resetFilters}>{k("reset", lang)}</button>
        <button type="button" className="bl-g-btn k1-primary" onClick={onClose}>{k("show", lang, count)}</button>
      </div>
    </section>
  );
}

/* ---------- Karten-Werkzeuge rechts: Ebenen, Teilen, Standort ---------- */
function MapTools({ clarity, setClarity }: { clarity: boolean; setClarity: (v: boolean) => void }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mapStyle = useAppStore((s) => s.mapStyle);
  const setMapStyle = useAppStore((s) => s.setMapStyle);
  const mapLabels = useAppStore((s) => s.mapLabels);
  const setMapLabels = useAppStore((s) => s.setMapLabels);
  const mapView = useAppStore((s) => s.mapView);
  const filters = useAppStore((s) => s.filters);
  const query = useAppStore((s) => s.query);
  const selectedId = useAppStore((s) => s.selectedId);
  const mode = mapStyle === "sat" ? (clarity ? "clarity" : "sat") : "map";
  function pick(m: "map" | "sat" | "clarity") {
    if (m === "map") return setMapStyle("map");
    // Gate: Satellitenansicht nur nach derselben Einwilligung wie die Vorschau.
    withSatConsent(() => {
      setMapStyle("sat");
      if (!mapLabels) setMapLabels(true);
      setClarity(m === "clarity");
    });
  }
  async function share() {
    const url = shareUrl({ ...mapView, id: selectedId, filters, query });
    try {
      if (navigator.share) return void (await navigator.share({ url, title: "Blue Lagune" }));
    } catch {
      /* weiter */
    }
    if (await copyShareUrl()) {
      setMsg(k("copied", lang));
      window.setTimeout(() => setMsg(null), 1800);
    }
  }
  return (
    <div className="k1-tools" data-bl-fab>
      {open ? (
        <div className="k1-layers" role="dialog" aria-label={k("layers", lang)} data-k1-layers>
          <div className="k1-layer-tiles">
            {(["map", "sat", "clarity"] as const).map((m) => (
              <button key={m} type="button" className="k1-layer" aria-pressed={mode === m} onClick={() => pick(m)}>
                <span className={cn("k1-layer-thumb", `k1-thumb-${m}`)} aria-hidden>
                  {m === "map" ? <MapIcon className="size-5" /> : m === "sat" ? <Satellite className="size-5" /> : <Sparkles className="size-5" />}
                </span>
                {k(m === "map" ? "map" : m === "sat" ? "sat" : "clarity", lang)}
                {m === "clarity" ? <span className="k1-badge-ph" data-k1-placeholder>{k("placeholder", lang)}</span> : null}
              </button>
            ))}
          </div>
          {mode === "clarity" ? <p className="k1-hint k1-ph-note" role="note" data-k1-clarity-note>{k("clarityNote", lang)}</p> : null}
          <button type="button" className="k1-row" aria-pressed={mapLabels} disabled={mapStyle !== "sat"} onClick={() => setMapLabels(!mapLabels)}>
            <BookOpen className="size-4" /> {k("labels", lang)}: {mapLabels ? k("on", lang) : k("off", lang)}
          </button>
        </div>
      ) : null}
      <button type="button" className="k1-tool" aria-label={k("layers", lang)} aria-expanded={open} onClick={() => setOpen(!open)} data-bl-layers>
        <Layers className="size-5" />
      </button>
      <button type="button" className="k1-tool" aria-label={k("shareMap", lang)} onClick={() => void share()}>
        <Share2 className="size-5" />
      </button>
      <div className="k1-tool-locate">
        <LocateButton floating />
      </div>
      {msg ? <p role="status" className="k1-toast">{msg}</p> : null}
    </div>
  );
}

/* ---------- Mehr-Menü ---------- */
function MoreSheet({ onClose, onPanel, onGuide, onLanding, offlineOpen }: { onClose: () => void; onPanel: (p: "route" | "add") => void; onGuide?: () => void; onLanding?: () => void; offlineOpen?: boolean }) {
  const lang = useLang();
  const consent = useSatConsent();
  return (
    <section className="k1-sheet" role="dialog" aria-label={k("mehr", lang)} data-k1-more>
      <div className="k1-sheet-head">
        <p className="bl-g-title-sm flex-1">{k("mehr", lang)}</p>
        <button type="button" className="bl-g-icon" aria-label={k("close", lang)} onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      <div className="k1-sheet-body">
        <div className="k1-group">
          <p className="k1-group-title">{k("secMap", lang)}</p>
          <OfflineButton label={k("offline", lang)} className="k1-row" openOnMount={offlineOpen} />
          <button type="button" className="k1-row" onClick={() => onPanel("route")}><Route className="size-4" /> {k("route", lang)}</button>
          <button type="button" className="k1-row" onClick={() => onPanel("add")}><Plus className="size-4" /> {k("add", lang)}</button>
        </div>
        <div className="k1-group">
          <p className="k1-group-title">{k("secApp", lang)}</p>
          <div className="k1-row k1-row-split">
            <span><Globe2 className="size-4" /> {k("lang", lang)}</span>
            <span className="k1-seg k1-seg-sm" role="group" aria-label={k("lang", lang)}>
              {(["de", "en"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </span>
          </div>
          <button type="button" className="k1-row" onClick={onGuide}><HelpCircle className="size-4" /> {k("guide", lang)}</button>
          <button type="button" className="k1-row" onClick={onLanding}><BookOpen className="size-4" /> {k("info", lang)}</button>
        </div>
        <div className="k1-group" data-k1-privacy>
          <p className="k1-group-title">{k("secPrivacy", lang)}</p>
          <div className="k1-row k1-row-split" data-k1-satpref>
            <span><Satellite className="size-4" /> {k("satPrev", lang)}: {consent.allowed ? k("on", lang) : k("off", lang)}</span>
            {consent.allowed ? (
              <button type="button" className="k1-mini" onClick={revokeSat} data-k1-sat-revoke>{k("revoke", lang)}</button>
            ) : (
              <button type="button" className="k1-mini" onClick={() => askSat()} data-k1-sat-ask>{k("allow", lang)}</button>
            )}
          </div>
          <a className="k1-row" href="/datenschutz">{k("privacy", lang)}</a>
        </div>
        <div className="k1-group">
          <p className="k1-group-title">{k("secLegal", lang)}</p>
          <a className="k1-row" href="/impressum">{k("imprint", lang)}</a>
          <a className="k1-row" href="/feedback">{k("feedback", lang)}</a>
          <p className="k1-attr">{k("attr", lang)}</p>
        </div>
      </div>
    </section>
  );
}

function ProSheet({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  return (
    <section className="k1-sheet k1-sheet-sm" role="dialog" aria-label={k("proTitle", lang)} data-k1-pro>
      <div className="k1-sheet-head">
        <p className="bl-g-title-sm flex-1">{k("proTitle", lang)}</p>
        <button type="button" className="bl-g-icon" aria-label={k("close", lang)} onClick={onClose}><X className="size-5" /></button>
      </div>
      <div className="k1-sheet-body">
        <K1ProContent />
      </div>
    </section>
  );
}

function PanelSheet({ stations, title, onClose }: { stations: Station[]; title: string; onClose: (() => void) | null }) {
  const lang = useLang();
  return (
    <section className="k1-sheet k1-sheet-panel" aria-label={title} data-bl-list>
      <div className="k1-sheet-head">
        <p className="bl-g-title-sm flex-1">{title}</p>
        {onClose ? <button type="button" className="bl-g-icon" aria-label={k("close", lang)} onClick={onClose}><X className="size-5" /></button> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <StationPanel stations={stations} />
      </div>
    </section>
  );
}

/* ---------- Tab-Bar ---------- */
function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const lang = useLang();
  const favs = useAppStore((s) => s.favorites.length);
  const items: { id: Tab; icon: typeof MapIcon }[] = [
    { id: "karte", icon: MapIcon },
    { id: "liste", icon: List },
    { id: "favoriten", icon: Heart },
    { id: "pro", icon: Crown },
    { id: "mehr", icon: MoreHorizontal },
  ];
  return (
    <nav className="k1-tabbar" aria-label="Navigation" data-k1-tabbar>
      {items.map(({ id, icon: Icon }) => (
        <button key={id} type="button" className="k1-tab" aria-current={tab === id ? "page" : undefined} onClick={() => onTab(id)} data-k1-tab={id}>
          <span className="k1-tab-icon">
            <Icon className="size-[22px]" />
            {id === "favoriten" && favs ? <span className="k1-dot">{favs}</span> : null}
          </span>
          <span>{k(id, lang)}</span>
        </button>
      ))}
    </nav>
  );
}

export function Konzept1Shell(props: ShellProps) {
  const { stations, initial, offlineOpen, onGuide, onLanding } = props;
  const lang = useLang();
  const panel = useAppStore((s) => s.panel);
  const setPanel = useAppStore((s) => s.setPanel);
  const selectedId = useAppStore((s) => s.selectedId);
  const extra = useAppStore((s) => s.extraStations);
  const selected = selectedId ? allStations(extra).find((s) => s.id === selectedId) : undefined;
  const [tab, setTab] = useState<Tab>(offlineOpen ? "mehr" : "karte");
  const [search, setSearch] = useState(false);
  const [clarity, setClarity] = useState(false);
  const [sub, setSub] = useState<"route" | "add" | "details" | null>(null);
  const recent = useRecent();
  const desktop = useDesktop();
  useK1ProChipSeen(!search);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.shell = "g";
    el.dataset.k = "1";
    return () => {
      delete el.dataset.shell;
      delete el.dataset.k;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.clarity = clarity ? "1" : "0";
  }, [clarity]);
  useEffect(() => {
    if (selectedId) {
      setTab("karte");
      setSub(null);
    }
  }, [selectedId]);

  function onTab(next: Tab) {
    setSearch(false);
    setSub(null);
    if (next === "liste") setPanel("list");
    if (next === "favoriten") setPanel("saved");
    if (next !== "karte" && selectedId) useAppStore.getState().select(null);
    setTab(next === tab && next !== "karte" ? "karte" : next);
  }

  const detail = tab === "karte" && !sub && panel === "detail" && selected ? selected : null;
  let overlay: React.ReactNode = null;
  if (sub) overlay = <PanelSheet stations={stations} title={sub === "route" ? k("route", lang) : sub === "add" ? k("add", lang) : selected?.name ?? ""} onClose={() => (setSub(null), setPanel("list"))} />;
  else if (search) overlay = <SearchSheet stations={stations} inView={props.inViewCount} recent={recent} onClose={() => setSearch(false)} />;
  else if (tab === "liste") overlay = <PanelSheet stations={stations} title={k("liste", lang)} onClose={() => setTab("karte")} />;
  else if (tab === "favoriten") overlay = <PanelSheet stations={stations} title={k("favoriten", lang)} onClose={() => setTab("karte")} />;
  else if (tab === "pro") overlay = <ProSheet onClose={() => setTab("karte")} />;
  else if (tab === "mehr")
    overlay = (
      <MoreSheet
        offlineOpen={offlineOpen}
        onClose={() => setTab("karte")}
        onPanel={(p) => {
          setPanel(p);
          setSub(p);
        }}
        onGuide={onGuide}
        onLanding={onLanding}
      />
    );
  // Desktop (≥ 1024 px): Panel links ist nie leer – Karte-Tab zeigt Detail oder die Liste im Ausschnitt.
  if (desktop && !overlay && !detail) overlay = <PanelSheet stations={stations} title={k("nearby", lang)} onClose={null} />;

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg bl-g k1" data-chrome="map" data-k1-layout={desktop ? "desktop" : "mobile"}>
      {desktop ? <div className="k1-panel-bg" aria-hidden /> : null}
      <section className="sr-only">
        <h1>{t("srTitle")}</h1>
        <p>{t("srLead")}</p>
      </section>
      <main className="absolute inset-0">
        <MapHost stations={stations} initialView={initial} />
        <div className="bl-map-fade" aria-hidden />
      </main>
      <div className="bl-g-top k1-top" data-bl-keep-clear>
        <BigSearch onOpen={() => setSearch(true)} />
        <OfflineNotice />
      </div>
      {/* Slot Pro-Chip auf der Karte (Inhalt/Metrik: miniHard, minihard/k1-pro). Bleibt sichtbar. */}
      {!search ? (
        <button type="button" className="k1-pro-chip" onClick={() => onTab("pro")} data-k1-pro-chip aria-label={k("proTitle", lang)}>
          <Crown className="size-4" aria-hidden />
          <span>{k("proChip", lang)}</span>
        </button>
      ) : null}
      {desktop && detail ? (
        <DetailCard station={detail} sat onMore={() => (setPanel("detail"), setSub("details"))} />
      ) : null}
      {desktop ? (
        <>
          {overlay && !detail ? overlay : null}
          <MapTools clarity={clarity} setClarity={setClarity} />
          <SatConsentPrompt className="k1-ask" />
        </>
      ) : overlay ?? (
        <>
          {detail ? null : <MapTools clarity={clarity} setClarity={setClarity} />}
          {detail ? (
            <DetailCard station={detail} sat onMore={() => (setPanel("detail"), setSub("details"))} />
          ) : (
            <div className="k1-bottom">
              <SatConsentPrompt className="k1-ask" />
              <Carousel stations={stations} sat onList={() => onTab("liste")} />
            </div>
          )}
        </>
      )}
      {overlay && !desktop ? <SatConsentPrompt onlyWhenAsked className="k1-ask k1-ask-float" /> : null}
      <TabBar tab={search ? "karte" : tab} onTab={onTab} />
    </div>
  );
}
