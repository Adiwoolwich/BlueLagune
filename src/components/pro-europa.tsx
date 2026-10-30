import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { proText } from "@/lib/pro-texts";
import { endDateLabel, variantForThisPage } from "@/lib/pro-test";
import { chipSeenOnce, sendProMetric } from "@/lib/pro-metric";

function ProContent({ asPage, onClose }: { asPage?: boolean; onClose?: () => void }) {
  const lang = useLang();
  const tx = proText(lang);
  const v = variantForThisPage();
  const [done, setDone] = useState(false);
  const H = asPage ? "h1" : "h2";
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <H id="bl-pro-title" className="font-display text-2xl leading-tight text-fg">{tx.headline[v]}</H>
      <ul className="space-y-2 text-fg">{tx.benefits[v].map((b) => <li key={b}>{b}</li>)}</ul>
      <div data-bl-pro-price className="rounded-xl bg-surface p-3 ring-1 ring-border">
        <p className="text-lg font-semibold text-fg">{tx.price}</p>
        <p className="mt-1 font-semibold text-stale">{tx.preview}</p>
      </div>
      <p className="text-muted">{tx.honest}</p>
      <p className="text-muted">{tx.until.replace("{date}", endDateLabel(lang))}</p>
      {done ? (
        <p role="status" className="rounded-xl bg-primary/10 p-3 font-medium text-fg">{tx.thanks}</p>
      ) : (
        <button type="button" onClick={() => { setDone(true); sendProMetric("pro_interest", v); }} className="bl-tap h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-fg">
          {tx.cta}
        </button>
      )}
      <dl className="space-y-2 text-muted">
        {tx.faq.map(([q, a]) => (
          <div key={q}><dt className="font-medium text-fg">{q}</dt><dd>{a}</dd></div>
        ))}
      </dl>
      {onClose ? (
        <button type="button" onClick={onClose} className="h-11 w-full rounded-xl ring-1 ring-border">{tx.close}</button>
      ) : null}
    </div>
  );
}

export function ProModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="bl-pro-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-elevated p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-fg shadow-xl outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-1 flex justify-end bg-bg-elevated px-2 pt-2">
          <button type="button" data-bl-pro-close-top onClick={onClose} aria-label={proText(lang).close}
            className="bl-tap inline-flex size-11 items-center justify-center rounded-full text-xl leading-none text-fg ring-1 ring-border">×</button>
        </div>
        <ProContent onClose={onClose} />
      </div>
    </div>
  );
}

export function ProChip({ onOpen }: { onOpen: () => void }) {
  const lang = useLang();
  useEffect(() => chipSeenOnce(variantForThisPage()), []);
  return (
    <button type="button" data-bl-pro-chip onClick={onOpen}
      className="bl-tap bl-pro-chip pointer-events-auto h-11 rounded-full bg-chrome px-4 text-sm font-semibold shadow-[var(--shadow-btn)] ring-1 ring-border">
      {proText(lang).chip}
    </button>
  );
}

export function ProDetailLine({ onOpen }: { onOpen: () => void }) {
  const lang = useLang();
  return (
    <button type="button" data-bl-pro-detail onClick={onOpen} className="mt-3 min-h-11 w-full rounded-xl bg-surface px-3 text-left text-sm text-primary ring-1 ring-border">
      {proText(lang).detail}
    </button>
  );
}

export function ProPage() {
  useLang();
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-xl items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <a href="/" className="inline-flex h-11 items-center rounded-lg bg-surface px-3 text-sm ring-1 ring-border">‹ Blue Lagune</a>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-10"><ProContent asPage /></main>
    </div>
  );
}

/** Globaler Öffner (Chip + Detailzeile teilen ein Modal), kein Speicher. */
type L = (open: boolean) => void;
const listeners = new Set<L>();
export function openPro() { listeners.forEach((l) => l(true)); }
export function useProModal(): [boolean, (o: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => { listeners.add(setOpen); return () => { listeners.delete(setOpen); }; }, []);
  return [open, setOpen];
}
