import { useEffect, useMemo, useRef, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { t, useLang } from "../lib/i18n";
import { useAppStore } from "../lib/store";
import {
  boundsFromRadius,
  boundsFromView,
  cacheAvailable,
  clearTiles,
  countCached,
  estimateMb,
  planDownload,
  readMeta,
  rememberSave,
  saveTiles,
  storageLabel,
  type SaveKind,
} from "../lib/offline-tiles";
import { cn } from "../lib/utils";

export function OfflineButton({ floating, openOnMount }: { floating?: boolean; openOnMount?: boolean }) {
  useLang();
  const [open, setOpen] = useState(Boolean(openOnMount));
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-bl-keep-clear
        title={!online ? t("offlineOffline") : t("offlineTitle")}
        className={cn(
          "relative inline-flex items-center justify-center bg-bg-elevated text-fg ring-1 ring-border",
          floating ? "size-11 shrink-0 rounded-full shadow-panel" : "h-11 w-11 rounded-xl",
        )}
        aria-label={t("offlineTitle")}
      >
        <Download className="size-5" />
        {!online ? <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-bad ring-2 ring-black" aria-hidden /> : null}
      </button>
      {open ? <OfflineSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function OfflineNotice() {
  useLang();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="pointer-events-auto absolute left-3 right-3 top-[5.25rem] z-30 mx-auto flex max-w-md items-center gap-2 rounded-xl bg-black/90 px-3 py-2 text-xs text-white ring-1 ring-white/20">
      <WifiOff className="size-4 shrink-0 text-bad" aria-hidden />
      <span>{t("offlineOffline")}</span>
    </div>
  );
}

function OfflineSheet({ onClose }: { onClose: () => void }) {
  useLang();
  const mapView = useAppStore((s) => s.mapView);
  const bounds = useAppStore((s) => s.bounds);
  const userPos = useAppStore((s) => s.userPos);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState(readMeta);
  const [cached, setCached] = useState(0);
  const [usage, setUsage] = useState<string | null>(null);
  const [okCache, setOkCache] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void cacheAvailable().then(setOkCache);
    void countCached().then(setCached);
    void storageLabel().then(setUsage);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      abort.current?.abort();
    };
  }, []);

  const viewBounds = bounds ?? boundsFromView(mapView);
  const center = userPos ?? { lat: mapView.lat, lng: mapView.lng };

  const plans = useMemo(() => {
    const view = planDownload(viewBounds, mapView.zoom);
    const r25 = planDownload(boundsFromRadius(center.lat, center.lng, 25), Math.max(mapView.zoom, 11));
    const r50 = planDownload(boundsFromRadius(center.lat, center.lng, 50), Math.max(mapView.zoom, 10));
    return { view, 25: r25, 50: r50 } as const;
  }, [viewBounds, mapView.zoom, center.lat, center.lng]);

  async function start(kind: SaveKind) {
    if (!okCache || busy) return;
    if (!online) {
      setMsg(t("offlineNeedNet"));
      return;
    }
    const plan = kind === "view" ? plans.view : plans[kind];
    if (plan.urls.length < 4) {
      setMsg(t("offlineZoomIn"));
      return;
    }
    const ac = new AbortController();
    abort.current = ac;
    setBusy(true);
    setDone(0);
    setTotal(plan.urls.length);
    setMsg(null);
    try {
      const result = await saveTiles(plan.urls, (d, n) => {
        setDone(d);
        setTotal(n);
      }, ac.signal);
      const next = {
        at: Date.now(),
        tiles: result.saved,
        label: kind === "view" ? t("offlineView") : t("offlineAround", { n: kind }),
        zoom: plan.zMax,
      };
      rememberSave(next);
      setMeta(next);
      setCached(await countCached());
      setUsage(await storageLabel());
      setMsg(
        result.failed > 0
          ? t("offlinePartial", { saved: result.saved, failed: result.failed })
          : t("offlineSaved", { n: result.saved, mb: estimateMb(result.saved) }),
      );
    } catch {
      setMsg(t("offlineFail"));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  async function wipe() {
    if (busy) return;
    await clearTiles();
    setMeta(null);
    setCached(0);
    setUsage(await storageLabel());
    setMsg(t("offlineCleared"));
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/50 p-3 md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("offlineTitle")}
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-bg-elevated shadow-panel ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-base font-semibold text-fg">{t("offlineTitle")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("offlineLead")}</p>
          </div>
          <button type="button" onClick={onClose} className="h-11 rounded-xl bg-surface px-3 text-sm ring-1 ring-border">
            {t("close")}
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="rounded-lg bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
            {online ? t("offlineOnline") : t("offlineOffline")}
            {cached > 0 ? ` · ${t("offlineHave", { n: cached })}${usage ? ` · ${usage}` : ""}` : ""}
          </p>
          {!okCache ? <p className="text-sm text-bad">{t("offlineNoCache")}</p> : null}
          {meta ? (
            <p className="text-sm text-fg">
              {t("offlineLast", { label: meta.label, mb: estimateMb(meta.tiles) })}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || !okCache}
            onClick={() => void start("view")}
            className="flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-50"
          >
            <span>{t("offlineSaveView")}</span>
            <span className="text-xs font-medium opacity-90">~{estimateMb(plans.view.urls.length)} MB</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !okCache}
              onClick={() => void start(25)}
              className="flex h-12 flex-col items-center justify-center rounded-xl bg-surface text-sm font-medium ring-1 ring-border disabled:opacity-50"
            >
              {t("offlineAround", { n: 25 })}
              <span className="text-[11px] font-normal text-muted">~{estimateMb(plans[25].urls.length)} MB</span>
            </button>
            <button
              type="button"
              disabled={busy || !okCache}
              onClick={() => void start(50)}
              className="flex h-12 flex-col items-center justify-center rounded-xl bg-surface text-sm font-medium ring-1 ring-border disabled:opacity-50"
            >
              {t("offlineAround", { n: 50 })}
              <span className="text-[11px] font-normal text-muted">~{estimateMb(plans[50].urls.length)} MB</span>
            </button>
          </div>

          {busy ? (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-center text-xs tabular-nums text-muted">
                {t("offlineProgress", { done, total, pct })}
              </p>
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                className="mt-2 h-11 w-full rounded-xl text-sm text-muted ring-1 ring-border"
              >
                {t("navCancel")}
              </button>
            </div>
          ) : null}

          {msg ? <p className="text-sm text-fg">{msg}</p> : null}

          <button
            type="button"
            disabled={busy || cached === 0}
            onClick={() => void wipe()}
            className="h-11 w-full rounded-xl text-sm text-muted ring-1 ring-border disabled:opacity-40"
          >
            {t("offlineDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
