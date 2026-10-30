import { useEffect, useRef, useState } from "react";
import { SAT_PREVIEW, SAT_PREVIEW_ATTRIBUTION, SAT_PREVIEW_MOCK, SAT_PREVIEW_POWERED, previewGrid, setSatChoice, useSatChoice } from "../lib/sat-preview";
import { useLang } from "../lib/i18n";
import { cn } from "../lib/utils";

export const SAT_TXT = {
  ask: { de: "Satellitenvorschau anzeigen?", en: "Show satellite previews?", nl: "Satellietvoorbeelden tonen?" },
  why: {
    de: "Die Bilder lädt dein Browser direkt von Esri (USA); dabei wird deine IP-Adresse übertragen.",
    en: "Your browser loads the images directly from Esri (USA); your IP address is transmitted.",
    nl: "Je browser laadt de beelden rechtstreeks van Esri (VS); daarbij wordt je IP-adres doorgegeven.",
  },
  yes: { de: "Ja", en: "Yes", nl: "Ja" },
  no: { de: "Nein", en: "No", nl: "Nee" },
  mock: { de: "Mock", en: "Mock", nl: "Mock" },
} as const;

/** Sichtbarkeit (IntersectionObserver); ohne IO-Unterstützung gilt sichtbar. */
function useVisible<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setVis(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVis(true), io.disconnect()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, vis];
}

/** Vektor-Miniatur: gestylter Platzhalter nur aus --bl-*-Tokens (ohne Einwilligung und als Rückfall). */
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
  const choice = useSatChoice();
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [failed, setFailed] = useState(false);
  if (!SAT_PREVIEW) return null;
  const grid = previewGrid(lat, lng);
  const live = choice === "yes" && visible && !failed && grid.tiles.every((t) => t.url);
  const seed = Math.abs(Math.round(lat * 1000 + lng * 1000));
  return (
    <div ref={ref} className={cn("bl-sat", className)} style={{ height }} data-bl-sat={live ? (SAT_PREVIEW_MOCK ? "mock" : "live") : "vector"}>
      {live ? (
        <span className="bl-sat-grid" style={{ left: `calc(50% - ${grid.offX}px)`, top: `calc(50% - ${grid.offY}px)` }}>
          {grid.tiles.map((t) => (
            <img key={`${t.x}-${t.y}`} src={t.url!} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} className="bl-sat-tile" style={{ left: t.left, top: t.top }} onError={() => setFailed(true)} />
          ))}
        </span>
      ) : (
        <VectorMini seed={seed} />
      )}
      <span className="bl-sat-pin" aria-hidden />
      {live ? (
        <span className="bl-sat-attr">
          {SAT_PREVIEW_MOCK ? <b className="bl-sat-mock">{SAT_TXT.mock[lang]} · </b> : null}
          {SAT_PREVIEW_POWERED} | {SAT_PREVIEW_ATTRIBUTION}
        </span>
      ) : null}
    </div>
  );
}

/** Einmalige Abfrage; erscheint nur, solange noch keine Wahl getroffen wurde. */
export function SatConsentPrompt({ className }: { className?: string }) {
  const lang = useLang();
  const choice = useSatChoice();
  if (!SAT_PREVIEW || choice) return null;
  return (
    <div role="dialog" aria-label={SAT_TXT.ask[lang]} className={cn("bl-sat-ask", className)} data-bl-sat-ask>
      <p className="bl-sat-ask-q">{SAT_TXT.ask[lang]}</p>
      <p className="bl-sat-ask-why">{SAT_TXT.why[lang]}</p>
      <div className="bl-sat-ask-row">
        <button type="button" className="bl-sat-ask-btn" onClick={() => setSatChoice("no")}>{SAT_TXT.no[lang]}</button>
        <button type="button" className="bl-sat-ask-btn bl-sat-ask-yes" onClick={() => setSatChoice("yes")}>{SAT_TXT.yes[lang]}</button>
      </div>
    </div>
  );
}
