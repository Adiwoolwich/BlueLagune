import { cn } from "@/lib/utils";
import { setLang, t, useLang } from "@/lib/i18n";

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
        "flex shrink-0 items-center justify-center gap-3 text-[11px] leading-none text-muted",
        className,
      )}
    >
      {onGuide ? (
        <>
          <button type="button" onClick={onGuide} className="hover:text-fg">
            {t("footerEmpty")}
          </button>
          <span aria-hidden className="text-subtle">
            ·
          </span>
        </>
      ) : null}
      <a href="/impressum" className="hover:text-fg">
        {t("footerImprint")}
      </a>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <a href="/feedback" className="hover:text-fg">
        {t("footerFeedback")}
      </a>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <span className="inline-flex items-center gap-1" role="group" aria-label={t("langToggle")}>
        <button
          type="button"
          onClick={() => setLang("de")}
          className={lang === "de" ? "font-semibold text-fg" : "hover:text-fg"}
          aria-pressed={lang === "de"}
        >
          {t("langDe")}
        </button>
        <span aria-hidden>|</span>
        <button
          type="button"
          onClick={() => setLang("en")}
          className={lang === "en" ? "font-semibold text-fg" : "hover:text-fg"}
          aria-pressed={lang === "en"}
        >
          {t("langEn")}
        </button>
      </span>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <a href="/datenschutz" className="hover:text-fg">
        {t("footerPrivacy")}
      </a>
    </footer>
  );
}
