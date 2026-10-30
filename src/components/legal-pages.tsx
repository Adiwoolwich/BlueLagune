import { useState, type ReactNode } from "react";
import { SAT_LATER_KEY, revokeSat, useSatConsent } from "@/lib/sat-preview";
import { LEGAL_TOKEN_CSS } from "@/theme/legal-tokens";
import "@/theme/legal-sat.css";
import { LEGAL, hasCompleteImprint } from "@/lib/legal";
import { SiteFooter } from "@/components/site-footer";
import { t, useLang } from "@/lib/i18n";

function Shell({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <a href="/" className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface px-3 text-sm ring-1 ring-border">
          {t("backMap")}
        </a>
        <div className="ml-auto font-display text-lg text-primary">Blue Lagune</div>
      </header>
      <article className="mx-auto max-w-3xl px-4 pb-8">
        <p className="text-xs tracking-wide text-muted uppercase">{kicker}</p>
        <h1 className="mt-1 font-display text-4xl leading-tight">{title}</h1>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-fg [&_a]:text-primary">
          {children}
        </div>
      </article>
      <SiteFooter className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
    </div>
  );
}

export function ImpressumPage() {
  useLang();
  const odr = t("imprintOdrP", { url: "https://ec.europa.eu/consumers/odr" });
  const [odrBefore, odrAfter] = odr.split("https://ec.europa.eu/consumers/odr");
  return (
    <Shell kicker={t("legalKicker")} title={t("imprintTitle")}>
      <p>{t("imprintP1")}</p>
      <h2>{t("imprintProvider")}</h2>
      {hasCompleteImprint() ? (
        <p>
          {LEGAL.operatorName}
          <br />
          {LEGAL.street}
          <br />
          {LEGAL.zip} {LEGAL.city}
          <br />
          {LEGAL.country}
        </p>
      ) : (
        <p>{t("imprintFallback")}</p>
      )}
      <h2>{t("imprintContact")}</h2>
      <p>
        E-Mail: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      </p>
      <h2>{t("imprintResponsible")}</h2>
      <p>{t("imprintResponsibleP", { name: LEGAL.operatorName || t("imprintOperator") })}</p>
      <h2>{t("imprintLiability")}</h2>
      <p>{t("imprintLiabilityP")}</p>
      <h2>{t("imprintOdr")}</h2>
      <p>
        {odrBefore}
        <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer" target="_blank">
          https://ec.europa.eu/consumers/odr
        </a>
        {odrAfter}
      </p>
    </Shell>
  );
}

/* Kapitel „Satellitenvorschau“ (miniHard, k1-pro): DSE-Text = privacySatP (wörtlich Lex, Abschnitt 2), hier nur einmal.
 * Status + Widerruf: Schlüssel bl-sat-preview (localStorage „yes“); beim Widerruf auch bl-sat-preview-later (sessionStorage) löschen. */
const SAT_UI = {
  de: { h: "Satellitenvorschau", st: "Status deiner Einwilligung:", yes: "erteilt", no: "nicht erteilt", btn: "Einwilligung widerrufen", done: "Deine Einwilligung ist widerrufen. Die App lädt nichts mehr von Esri.", err: "Widerruf nicht gespeichert: Dein Browser blockiert den Gerätespeicher. Bitte lösche die Website-Daten in den Browser-Einstellungen." },
  en: { h: "Satellite preview", st: "Status of your consent:", yes: "given", no: "not given", btn: "Withdraw consent", done: "Your consent has been withdrawn. The app no longer loads anything from Esri.", err: "Withdrawal not saved: your browser blocks device storage. Please delete the site data in your browser settings." },
};
function SatPreviewPrivacy() {
  const lang = useLang();
  const ui = lang === "de" ? SAT_UI.de : SAT_UI.en;
  const { allowed } = useSatConsent();
  const [msg, setMsg] = useState<string | null>(null);
  function revoke() {
    revokeSat();
    try {
      sessionStorage.removeItem(SAT_LATER_KEY);
      setMsg(localStorage.getItem("bl-sat-preview") === null ? ui.done : ui.err);
    } catch {
      setMsg(ui.err);
    }
  }
  return (
    <section id="satellitenvorschau" aria-labelledby="satellitenvorschau-h" className="bl-legal-tokens space-y-3">
      <style>{LEGAL_TOKEN_CSS}</style>
      <h2 id="satellitenvorschau-h">{ui.h}</h2>
      <p>{t("privacySatP")}</p>
      <p data-bl-sat-status className="bl-sat-status">
        {ui.st} <strong>{allowed ? ui.yes : ui.no}</strong>
      </p>
      <button type="button" onClick={revoke} disabled={!allowed}
        data-bl-sat-revoke className="bl-sat-revoke">
        {ui.btn}
      </button>
      {msg ? <p role="status" className="bl-sat-msg">{msg}</p> : null}
    </section>
  );
}

export function DatenschutzPage() {
  useLang();
  return (
    <Shell kicker={t("legalKicker")} title={t("privacyTitle")}>
      <p>
        {t("privacyP1")} (<a href="/impressum">{t("imprintTitle")}</a>).
      </p>
      <h2>{t("privacyWhich")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">{t("privacyMap")}</strong> {t("privacyMapP")} <a href="#satellitenvorschau">{useLang() === "de" ? "→ Satellitenvorschau" : "→ Satellite preview"}</a>
        </li>
        <li>
          <strong className="text-fg">{t("privacyLoc")}</strong> {t("privacyLocP")}
        </li>
        <li>
          <strong className="text-fg">{t("privacyLs")}</strong> {t("privacyLsP")}
        </li>
        <li>
          <strong className="text-fg">{t("privacyHost")}</strong> {t("privacyHostP")}
        </li>
        <li data-bl-privacy-visit>{t("privacyVisitP")}</li>
        <li data-bl-privacy-pro>{t("privacyProP")}</li>
        <li>
          <strong className="text-fg">{t("privacyData")}</strong> {t("privacyDataP")}
        </li>
        <li>
          <strong className="text-fg">{t("privacyGeo")}</strong> {t("privacyGeoP")}
        </li>
      </ul>
      <SatPreviewPrivacy />
      <h2>{t("privacyLaw")}</h2>
      <p>{t("privacyLawP")}</p>
      <h2>{t("privacyRights")}</h2>
      <p>
        {t("privacyRightsP")} <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
      <h2>{t("privacyCookies")}</h2>
      <p>{t("privacyCookiesP")}</p>
    </Shell>
  );
}
