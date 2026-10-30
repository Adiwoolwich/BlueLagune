import { useEffect, useState } from "react";
import { Satellite } from "lucide-react";
import { SAT_PREVIEW, SAT_PREVIEW_ATTRIBUTION, SAT_PREVIEW_MOCK, grantSatConsent, previewGrid, useSatConsent } from "../lib/sat-preview";
import { useLang } from "../lib/i18n";
import { cn } from "../lib/utils";

const L = {
  show: { de: "Satellitenbilder zeigen", en: "Show satellite images", nl: "Satellietbeelden tonen" },
  mock: { de: "Mock", en: "Mock", nl: "Mock" },
} as const;

/** Bild ohne Cache laden (fetch no-store → Blob-URL, beim Abbau freigeben). */
function useNoStoreImage(url: string | null): { src: string | null; failed: boolean } {
  const [state, set] = useState<{ src: string | null; failed: boolean }>({ src: null, failed: false });
  useEffect(() => {
    if (!url) return set({ src: null, failed: true });
    let obj: string | null = null;
    let dead = false;
    fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (dead) return;
        obj = URL.createObjectURL(b);
        set({ src: obj, failed: false });
      })
      .catch(() => !dead && set({ src: null, failed: true }));
    return () => {
      dead = true;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [url]);
  return state;
}

function Tile({ url, left, top, onFail }: { url: string | null; left: number; top: number; onFail: () => void }) {
  const { src, failed } = useNoStoreImage(url);
  useEffect(() => {
    if (failed) onFail();
  }, [failed, onFail]);
  return src ? <img src={src} alt="" draggable={false} className="bl-sat-tile" style={{ left, top }} /> : null;
}

function Pin() {
  return <span className="bl-sat-pin" aria-hidden />;
}

/** Vektor-Miniatur: gestylter Platzhalter nur aus --bl-*-Tokens (vor Einwilligung und als Rückfall). */
function VectorMini({ seed }: { seed: number }) {
  return (
    <span className="bl-sat-vector" aria-hidden style={{ ["--bl-sat-rot" as string]: `${(seed % 60) - 30}deg` }}>
      <span className="bl-sat-road bl-sat-road-a" />
      <span className="bl-sat-road bl-sat-road-b" />
      <span className="bl-sat-block" />
    </span>
  );
}

export function SatPreview({ lat, lng, className, height = 112 }: { lat: number; lng: number; className?: string; height?: number }) {
  const lang = useLang();
  const consent = useSatConsent();
  const [failed, setFailed] = useState(false);
  if (!SAT_PREVIEW) return null;
  const grid = previewGrid(lat, lng);
  const live = consent && !failed && grid.tiles.every((t) => t.url);
  const seed = Math.abs(Math.round(lat * 1000 + lng * 1000));
  return (
    <div className={cn("bl-sat", className)} style={{ height }} data-bl-sat={live ? (SAT_PREVIEW_MOCK ? "mock" : "live") : "vector"}>
      {live ? (
        <span className="bl-sat-grid" style={{ left: `calc(50% - ${grid.offX}px)`, top: `calc(50% - ${grid.offY}px)` }}>
          {grid.tiles.map((t) => (
            <Tile key={`${t.x}-${t.y}`} url={t.url} left={t.left} top={t.top} onFail={() => setFailed(true)} />
          ))}
        </span>
      ) : (
        <VectorMini seed={seed} />
      )}
      <Pin />
      {live ? (
        <span className="bl-sat-attr">
          {SAT_PREVIEW_MOCK ? <b className="bl-sat-mock">{L.mock[lang]}</b> : null} {SAT_PREVIEW_ATTRIBUTION}
        </span>
      ) : !consent ? (
        <button
          type="button"
          className="bl-sat-consent"
          onClick={(e) => {
            e.stopPropagation();
            grantSatConsent();
          }}
        >
          <Satellite className="size-4" /> {L.show[lang]}
        </button>
      ) : null}
    </div>
  );
}
