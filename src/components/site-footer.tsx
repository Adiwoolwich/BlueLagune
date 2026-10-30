import { cn } from "@/lib/utils";
import { setLang, t, useLang } from "@/lib/i18n";

/** Tippziel ≥ 44 × 44 px (WCAG 2.5.5), Schrift bleibt klein. */
const HIT = "inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 hover:text-fg";

export function SiteFooter({
  className,
  onGuide,
}: {
  className?: string;
  onGuide?: () => void;
}) {
  const lang = useLang();
  return (
    <footer
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-center gap-x-1 text-[11px] leading-none text-muted",
        className,
      )}
    >
      {onGuide ? (
        <>
          <button type="button" onClick={onGuide} className={HIT}>
            {t("footerEmpty")}
          </button>
          <span aria-hidden className="text-subtle">
            ·
          </span>
        </>
      ) : null}
      <a href="/impressum" className={HIT}>
        {t("footerImprint")}
      </a>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <a href="/feedback" className={HIT}>
        {t("footerFeedback")}
      </a>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <span className="inline-flex items-center" role="group" aria-label={t("langToggle")}>
        <button
          type="button"
          onClick={() => setLang("de")}
          className={cn(HIT, lang === "de" ? "font-semibold text-fg" : "hover:text-fg")}
          aria-pressed={lang === "de"}
        >
          {t("langDe")}
        </button>
        <span aria-hidden>|</span>
        <button
          type="button"
          onClick={() => setLang("en")}
          className={cn(HIT, lang === "en" ? "font-semibold text-fg" : "hover:text-fg")}
          aria-pressed={lang === "en"}
        >
          {t("langEn")}
        </button>
      </span>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <a href="/datenschutz" className={HIT}>
        {t("footerPrivacy")}
      </a>
    </footer>
  );
}
