import { useEffect, useRef, useState } from "react";
import { SAT_ASK, SAT_PREVIEW, SAT_PREVIEW_MOCK, SAT_PREVIEW_POWERED, useSatPreviewSources, allowSat, askSat, l2, notNowSat, previewGrid, satAskVisible, useSatConsent } from "../lib/sat-preview";
import { useLang } from "../lib/i18n";
import { cn } from "../lib/utils";



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
  const consent = useSatConsent();
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [failed, setFailed] = useState(false);
  if (!SAT_PREVIEW) return null;
  const grid = previewGrid(lat, lng);
  const live = consent.allowed && visible && !failed && grid.tiles.every((t) => t.url);
  const sources = useSatPreviewSources(live);
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
      {!consent.allowed ? (
        <span
          role="button"
          tabIndex={0}
          className="bl-sat-hit"
          aria-label={l2(SAT_ASK.q, lang)}
          data-bl-sat-placeholder
          onClick={(e) => (e.stopPropagation(), askSat())}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") (e.preventDefault(), e.stopPropagation(), askSat());
          }}
        />
      ) : null}
      <span className="bl-sat-pin" aria-hidden />
      {live ? (
        <span className="bl-sat-attr">
          {SAT_PREVIEW_MOCK ? <b className="bl-sat-mock">Mock · </b> : null}
          {SAT_PREVIEW_POWERED} | {sources}
        </span>
      ) : null}
    </div>
  );
}

/** Abfrage mit zwei gleichwertigen Knöpfen, nichts vorausgewählt (Wortlaut: Lex, 30.10.2026). */
export function SatConsentPrompt({ className, onlyWhenAsked }: { className?: string; onlyWhenAsked?: boolean }) {
  const lang = useLang();
  const st = useSatConsent();
  if (!satAskVisible() || (onlyWhenAsked && !st.open) || (!SAT_PREVIEW && !st.open)) return null;
  return (
    <div role="dialog" aria-label={l2(SAT_ASK.q, lang)} className={cn("bl-sat-ask", className)} data-bl-sat-ask>
      <p className="bl-sat-ask-q">{l2(SAT_ASK.q, lang)}</p>
      <p className="bl-sat-ask-why">{l2(SAT_ASK.body, lang)}</p>
      <div className="bl-sat-ask-row">
        <button type="button" className="bl-sat-ask-btn" onClick={allowSat} data-bl-sat-allow>{l2(SAT_ASK.allow, lang)}</button>
        <button type="button" className="bl-sat-ask-btn" onClick={notNowSat} data-bl-sat-later>{l2(SAT_ASK.notNow, lang)}</button>
      </div>
    </div>
  );
}
