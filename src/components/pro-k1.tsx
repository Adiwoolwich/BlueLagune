/** Konzept 1: Pro-Europa-Inhalt im Pro-Tab + pro_chip_seen am Karten-Chip (miniHard, minihard/k1-pro).
 * Texte/Varianten/Metrik unverändert aus pro-europa (b3cbeaa, nur DE/EN). Styles nur über var(--bl-*). */
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { proText } from "@/lib/pro-texts";
import { endDateLabel, proActive, variantForThisPage } from "@/lib/pro-test";
import { chipSeenOnce, sendProMetric } from "@/lib/pro-metric";
import "@/theme/pro-k1.css";

export function K1ProContent() {
  const lang = useLang();
  const tx = proText(lang);
  const v = variantForThisPage();
  const [done, setDone] = useState(false);
  return (
    <div className="k1-pro-body" data-bl-pro-variant={v}>
      <h2 id="bl-pro-title" className="k1-pro-h">{tx.headline[v]}</h2>
      <ul className="k1-pro-list">{tx.benefits[v].map((b) => <li key={b}>{b}</li>)}</ul>
      <div data-bl-pro-price className="k1-pro-price">
        <p className="k1-pro-price-main">{tx.price}</p>
        <p className="k1-pro-price-note">{tx.preview}</p>
      </div>
      <p className="k1-pro-muted">{tx.honest}</p>
      <p className="k1-pro-muted">{tx.until.replace("{date}", endDateLabel(lang))}</p>
      {done ? (
        <p role="status" className="k1-pro-thanks">{tx.thanks}</p>
      ) : (
        <button type="button" data-bl-pro-cta className="k1-pro-cta" onClick={() => { setDone(true); sendProMetric("pro_interest", v); }}>{tx.cta}</button>
      )}
      <dl className="k1-pro-faq">
        {tx.faq.map(([q, a]) => (
          <div key={q}><dt>{q}</dt><dd>{a}</dd></div>
        ))}
      </dl>
    </div>
  );
}

/** pro_chip_seen: Chip ist sichtbar UND echte Kartennutzung (Geste oder Suche), solange proActive – max. einmal pro Seitenaufruf. */
export function useK1ProChipSeen(chipVisible: boolean) {
  const gesture = useAppStore((s) => s.mapGesture);
  const searched = useAppStore((s) => !!s.filters.place || !!s.query);
  useEffect(() => {
    if (chipVisible && (gesture > 0 || searched) && proActive()) chipSeenOnce(variantForThisPage());
  }, [chipVisible, gesture, searched]);
  useChipBelowOfflineNote();
}

/** Mobil: unterkante des Offline-Hinweises → --k1-pro-chip-top (+8 px), damit Chip und Hinweis sich nie überlappen. */
function useChipBelowOfflineNote() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const n = document.querySelector(".k1-top [data-bl-offline-note]");
      const b = n?.getBoundingClientRect();
      if (b && b.height > 0) root.style.setProperty("--k1-pro-chip-top", `${Math.ceil(b.bottom + 8)}px`);
      else root.style.removeProperty("--k1-pro-chip-top");
    };
    update();
    const mo = new MutationObserver(update);
    const top = document.querySelector(".k1-top");
    if (top) mo.observe(top, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => { mo.disconnect(); window.removeEventListener("resize", update); root.style.removeProperty("--k1-pro-chip-top"); };
  }, []);
}
