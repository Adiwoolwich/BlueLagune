import { useEffect, useMemo, useRef, useState } from "react";
import { MapHost } from "./components/map-host";
import {
  MapRoundButtons,
  SearchAndFilters,
  SearchBar,
  StationPanel,
} from "./components/station-panel";
import { SiteFooter } from "./components/site-footer";
import { DatenschutzPage, ImpressumPage } from "./components/legal-pages";
import { FeedbackPage } from "./components/feedback-form";
import { DUMP_STATIONS, hasPreciseCoords } from "./lib/stations";
import { allStations, applyFilters, useAppStore } from "./lib/store";
import { inBounds } from "./lib/geo";
import { hasMapDeepLink, parseUrl } from "./lib/url-state";
import { fetchReports } from "./lib/reports";
import { t, useLang } from "./lib/i18n";
import { cn } from "./lib/utils";
import { installTapHaptic } from "./lib/tap";
import { OfflineNotice } from "./components/offline-panel";

const SKIP_KEY = "bl-skip-landing";

function useFilteredStations() {
  const query = useAppStore((s) => s.query);
  const filters = useAppStore((s) => s.filters);
  const reports = useAppStore((s) => s.reports);
  const userPos = useAppStore((s) => s.userPos);
  const route = useAppStore((s) => s.route);
  const routePath = useAppStore((s) => s.routePath);
  const corridorKm = useAppStore((s) => s.corridorKm);
  const extraStations = useAppStore((s) => s.extraStations);
  const serverReports = useAppStore((s) => s.serverReports);
  return useMemo(
    () =>
      applyFilters(allStations(extraStations), {
        query,
        filters,
        reports,
        serverReports,
        userPos,
        route,
        routePath,
        corridorKm,
      }),
    [query, filters, reports, serverReports, userPos, route, routePath, corridorKm, extraStations],
  );
}

function Landing({ onDone }: { onDone: (openOffline?: boolean) => void }) {
  const lang = useLang();
  const n = DUMP_STATIONS.length;
  const [visitors, setVisitors] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/visitors")
      .then((r) => r.json())
      .then((d: { count?: number }) => {
        if (typeof d.count === "number") setVisitors(d.count);
      })
      .catch(() => {});
  }, []);
  function go(persist: boolean, openOffline = false) {
    if (persist) {
      try {
        localStorage.setItem(SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    onDone(openOffline);
  }
  return (
    <div className="bl-landing relative min-h-dvh overflow-hidden text-fg">
      <div className="bl-landing-glow" aria-hidden />
      <svg className="bl-waves" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden>
        <path
          className="bl-wave-a"
          fill="#2c2c2e"
          fillOpacity="0.22"
          d="M0,192L80,176C160,160 320,128 480,133C640,139 800,181 960,181C1120,181 1280,139 1360,128L1440,117L1440,320L0,320Z"
        />
        <path
          className="bl-wave-b"
          fill="#1c1c1e"
          fillOpacity="0.18"
          d="M0,256L80,245C160,235 320,213 480,208C640,203 800,213 960,218C1120,224 1280,229 1360,232L1440,235L1440,320L0,320Z"
        />
      </svg>
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:max-w-xl sm:px-8">
        <header className="flex items-center gap-3">
          <span className="bl-mark">
            <span className="bl-ripple" aria-hidden />
            <svg className="bl-drop-bob" viewBox="0 0 24 32" width="22" height="28" aria-hidden>
              <path
                fill="currentColor"
                d="M12 1.5C12 1.5 3.5 12.2 3.5 19.2a8.5 8.5 0 0 0 17 0C20.5 12.2 12 1.5 12 1.5z"
              />
            </svg>
          </span>
          <div>
            <p className="font-display text-xl leading-none font-semibold sm:text-2xl">Blue Lagune</p>
            <p className="mt-1 text-sm text-muted">{t("landingKicker")}</p>
          </div>
        </header>
        <main className="mt-7 flex flex-1 flex-col sm:mt-12">
          <h1 className="text-[1.55rem] leading-snug font-semibold sm:text-3xl">{t("landingH1")}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{t("landingLead")}</p>
          <div className="mt-4 rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
            <p className="text-sm leading-relaxed text-fg">{t("landingOfflineHint")}</p>
            <button
              type="button"
              onClick={() => go(true, true)}
              className="mt-2 text-sm font-semibold text-primary underline underline-offset-4"
            >
              {t("landingOfflineCta")}
            </button>
          </div>
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
            <li className="bl-tile">
              <span className="bl-float text-primary" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s7-6.2 7-11.2A7 7 0 0 0 5 9.8C5 14.8 12 21 12 21z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="12" cy="9.8" r="2.2" fill="currentColor" />
                </svg>
              </span>
              <p className="text-[13px] leading-tight font-medium">{t("landingTileFind")}</p>
              <p className="text-[11px] leading-snug text-muted">{t("landingTileFindSub")}</p>
            </li>
            <li className="bl-tile">
              <span className="bl-float bl-float-2 text-primary" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path fill="currentColor" d="M12 2C12 2 5 11.2 5 16a7 7 0 0 0 14 0C19 11.2 12 2 12 2z" />
                  <circle className="bl-drip" cx="12" cy="8.2" r="1.35" fill="#04151c" />
                  <ellipse className="bl-icon-ripple" cx="12" cy="20" rx="4.2" ry="1.15" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
              <p className="text-[13px] leading-tight font-medium">{t("landingTileWater")}</p>
              <p className="text-[11px] leading-snug text-muted">{t("landingTileWaterSub")}</p>
            </li>
            <li className="bl-tile">
              <span className="bl-float bl-float-3 text-primary" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16.5V8.8c0-.7.5-1.3 1.2-1.4L12 6l6.8 1.4c.7.1 1.2.7 1.2 1.4v7.7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M4 16.5c1.6 0 2.2 1.5 4 1.5s2.4-1.5 4-1.5 2.2 1.5 4 1.5 2.4-1.5 4-1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <p className="text-[13px] leading-tight font-medium">{t("landingTileSave")}</p>
              <p className="text-[11px] leading-snug text-muted">{t("landingTileSaveSub")}</p>
            </li>
          </ul>
          <p className="mt-6 text-center text-sm tabular-nums text-muted">
            {t("landingCount", { n })}
            {visitors != null
              ? ` · ${t("landingVisitors", { n: visitors.toLocaleString(lang === "en" ? "en-GB" : lang === "nl" ? "nl-NL" : "de-DE") })}`
              : ""}
          </p>
          <div className="mt-auto flex flex-col items-center pt-8">
            <button
              type="button"
              onClick={() => go(true)}
              className="bl-cta h-12 w-full max-w-sm rounded-full bg-primary text-base font-semibold text-primary-fg shadow-btn"
            >
              {t("landingCta")}
            </button>
            <p className="mt-3 text-center text-xs text-subtle">{t("landingNext")}</p>
            <button
              type="button"
              onClick={() => go(false)}
              className="mt-4 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {t("landingOnce")}
            </button>
            <SiteFooter className="mt-8" />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Sheet snap heights in dvh (phone). Mid is lower on md+. */
function sheetSnaps(): { peek: number; mid: number; full: number } {
  const mid = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? 36.5 : 42;
  return { peek: 24, mid, full: 90 };
}

function sheetH(sheet: "peek" | "mid" | "full"): number {
  return sheetSnaps()[sheet];
}

function nearestSheet(h: number, snaps: ReturnType<typeof sheetSnaps>): "peek" | "mid" | "full" {
  const entries: ["peek" | "mid" | "full", number][] = [
    ["peek", snaps.peek],
    ["mid", snaps.mid],
    ["full", snaps.full],
  ];
  let best: "peek" | "mid" | "full" = "mid";
  let bestD = Infinity;
  for (const [k, v] of entries) {
    const d = Math.abs(h - v);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

function rubber(h: number, min: number, max: number): number {
  if (h < min) return min - (min - h) * 0.22;
  if (h > max) return max + (h - max) * 0.22;
  return h;
}

function SheetHandle({
  label,
  sheet,
  liveH,
  onLiveH,
  onSnap,
  onTap,
}: {
  label: string;
  sheet: "peek" | "mid" | "full";
  liveH: number | null;
  onLiveH: (h: number | null) => void;
  onSnap: (s: "peek" | "mid" | "full") => void;
  onTap: () => void;
}) {
  const startY = useRef<number | null>(null);
  const startH = useRef(0);
  const curH = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const vel = useRef(0);
  const dragged = useRef(false);

  function begin(y: number, target?: HTMLDivElement, pointerId?: number) {
    startY.current = y;
    lastY.current = y;
    lastT.current = performance.now();
    vel.current = 0;
    dragged.current = false;
    startH.current = liveH ?? sheetH(sheet);
    curH.current = startH.current;
    onLiveH(startH.current);
    if (target && pointerId != null) {
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  function move(y: number) {
    if (startY.current == null) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastT.current);
    vel.current = (y - lastY.current) / dt; // px/ms; +down
    lastY.current = y;
    lastT.current = now;
    if (Math.abs(y - startY.current) > 6) dragged.current = true;
    const snaps = sheetSnaps();
    const vh = window.innerHeight || 1;
    // finger up → taller sheet
    const deltaVh = ((startY.current - y) / vh) * 100;
    const nextH = rubber(startH.current + deltaVh, snaps.peek, snaps.full);
    curH.current = nextH;
    onLiveH(nextH);
  }

  function end() {
    if (startY.current == null) return;
    startY.current = null;
    const snaps = sheetSnaps();
    // Use ref — React state liveH is stale in the same gesture
    const h = curH.current;
    const v = vel.current; // +down
    let next: "peek" | "mid" | "full";
    // Tesla-near: low velocity threshold, clear step on flick
    if (v < -0.45) {
      next = h < snaps.mid - 2 ? "mid" : "full";
    } else if (v > 0.45) {
      next = h > snaps.mid + 2 ? "mid" : "peek";
    } else {
      next = nearestSheet(h, snaps);
    }
    onLiveH(null);
    if (!dragged.current && Math.abs(h - startH.current) < 1.2) onTap();
    else onSnap(next);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className="flex h-8 shrink-0 touch-none select-none items-center justify-center pt-1"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        begin(e.clientY, e.currentTarget, e.pointerId);
      }}
      onPointerMove={(e) => move(e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onSnap(sheet === "peek" ? "mid" : "full");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onSnap(sheet === "full" ? "mid" : "peek");
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      <span className="h-1 w-10 rounded-full bg-zinc-500" />
    </div>
  );
}

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/impressum") return <ImpressumPage />;
  if (path === "/datenschutz") return <DatenschutzPage />;
  if (path === "/feedback") return <FeedbackPage />;
  return <MapApp />;
}

function MapApp() {
  useLang();
  useEffect(() => installTapHaptic(), []);
  const initial = useMemo(() => parseUrl(), []);
  const [openOffline, setOpenOffline] = useState(false);
  const [showLanding, setShowLanding] = useState(() => {
    if (hasMapDeepLink()) return false;
    try {
      return localStorage.getItem(SKIP_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const stations = useFilteredStations();
  const panel = useAppStore((s) => s.panel);
  const sheet = useAppStore((s) => s.sheet);
  const setSheet = useAppStore((s) => s.setSheet);
  const sheetRef = useRef<HTMLElement>(null);
  const liveHRef = useRef<number | null>(null);
  const liveRaf = useRef<number | null>(null);
  const applyLiveSheet = (h: number | null) => {
    const el = sheetRef.current;
    if (!el) return;
    liveHRef.current = h;
    if (liveRaf.current != null) {
      cancelAnimationFrame(liveRaf.current);
      liveRaf.current = null;
    }
    el.style.transition = "none";
    if (h == null) {
      el.style.setProperty("--sheet-offset", (sheetSnaps().full - sheetH(sheet)) + "dvh");
      el.style.removeProperty("transition");
      return;
    }
    liveRaf.current = requestAnimationFrame(() => {
      liveRaf.current = null;
      const live = liveHRef.current;
      if (live != null) el.style.setProperty("--sheet-offset", (sheetSnaps().full - live) + "dvh");
    });
  };
  const [guide, setGuide] = useState(false);
  const routePath = useAppStore((s) => s.routePath);
  const bounds = useAppStore((s) => s.bounds);
  const inViewCount = useMemo(() => {
    if (!bounds) return stations.filter(hasPreciseCoords).length;
    return stations.filter((s) => hasPreciseCoords(s) && inBounds(s, bounds)).length;
  }, [stations, bounds]);

  useEffect(() => {
    fetch("/api/visitors").catch(() => {});
    void fetchReports()
      .then((r) => useAppStore.getState().setServerReports(r))
      .catch(() => {});
    void useAppStore.persist.rehydrate();
    const s = useAppStore.getState();
    if (Object.keys(initial.filters).length) s.setFilters(initial.filters);
    if (initial.query) {
      s.setQuery(initial.query);
      s.setFilters({ place: initial.query, ...initial.filters });
    }
    s.setMapView({ lat: initial.lat, lng: initial.lng, zoom: initial.zoom });
    if (initial.id) s.select(initial.id);
  }, [initial]);

  function cycleSheet() {
    if (panel !== "list") {
      setSheet(sheet === "full" ? "mid" : "full");
      return;
    }
    setSheet(sheet === "peek" ? "mid" : sheet === "mid" ? "full" : "peek");
  }


  if (showLanding) {
    return (
      <Landing
        onDone={(shouldOpenOffline) => {
          setShowLanding(false);
          setOpenOffline(Boolean(shouldOpenOffline));
        }}
      />
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg" data-chrome="map">
      <section className="sr-only">
        <h1>{t("srTitle")}</h1>
        <p>{t("srLead")}</p>
      </section>

      <main className="absolute inset-0">
        <MapHost stations={stations} initialView={initial} />
        <div
          data-bl-keep-clear
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2.5 px-3 pb-2 pt-[max(0.7rem,env(safe-area-inset-top))]"
        >
          <button
            type="button"
            className="bl-tap pointer-events-auto size-11 shrink-0 rounded-[10px] bg-black/80 text-white ring-1 ring-white/15"
            aria-label={t("back")}
            onClick={() => setShowLanding(true)}
          >
            <span className="text-lg leading-none">‹</span>
          </button>
          <div className="pointer-events-auto mx-auto min-w-0 w-full max-w-[min(58vw,22rem)]">
            <SearchBar overlay />
          </div>
          <OfflineNotice />
          <span className="size-11 shrink-0" aria-hidden />
        </div>
        <div className="pointer-events-auto absolute right-3 top-[12dvh] z-30">
          <MapRoundButtons offlineOpen={openOffline} />
        </div>
      </main>

      <aside
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-20 flex h-[90dvh] min-h-0 flex-col rounded-t-[1.25rem] bg-black transition-transform duration-150 ease-out"
        style={{
          transform: "translate3d(0, var(--sheet-offset), 0)",
          "--sheet-offset": (sheetSnaps().full - sheetH(sheet)) + "dvh",
        } as React.CSSProperties}
      >
        <SheetHandle
          label={t("sheetResize")}
          sheet={sheet}
          liveH={liveHRef.current}
          onLiveH={applyLiveSheet}
          onSnap={(s) => {
            applyLiveSheet(null);
            setSheet(s);
          }}
          onTap={cycleSheet}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {panel === "list" ? <SearchAndFilters count={inViewCount} compact={sheet === "peek"} /> : null}
          {routePath?.source === "straight" && panel === "list" && sheet !== "peek" ? (
            <p className="shrink-0 rounded-lg bg-stale/10 px-2.5 py-1.5 text-xs text-stale">{t("routeAir")}</p>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <StationPanel stations={stations} />
          </div>
        </div>
      </aside>

      {guide ? <GuideOverlay onClose={() => setGuide(false)} /> : null}
    </div>
  );
}

function GuideOverlay({ onClose }: { onClose: () => void }) {
  useLang();
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg p-5">
      <div className="mx-auto w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t("guideTitle")}</h2>
          <button type="button" onClick={onClose} className="h-11 rounded-xl bg-surface px-3 text-sm ring-1 ring-border">
            {t("close")}
          </button>
        </div>
        <ol className="space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-medium text-fg">{t("guide1t")}</span> {t("guide1")}
          </li>
          <li>
            <span className="font-medium text-fg">{t("guide2t")}</span>
          </li>
          <li>
            <span className="font-medium text-fg">{t("guide3t")}</span>
          </li>
          <li>
            <span className="font-medium text-fg">{t("guide4t")}</span>
          </li>
          <li>
            <span className="font-medium text-fg">{t("guide5t")}</span> {t("guide5")}
          </li>
        </ol>
      </div>
      <SiteFooter className="mt-auto px-4 pb-4" />
    </div>
  );
}
