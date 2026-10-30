/** Testseite „Pro Europa“ (Fake Door): Schalter + festes Enddatum. Keine Zahlung, keine Daten, kein Tracking. */
export const PRO_TEST = { enabled: true, endDate: "2026-11-27" } as const;
export type ProVariant = "europa" | "frankreich";

export function proActive(now: Date = new Date()): boolean {
  if (!PRO_TEST.enabled) return false;
  return now.getTime() <= new Date(PRO_TEST.endDate + "T23:59:59+01:00").getTime();
}

/** Zufällig pro Seitenaufruf, nichts gespeichert. ?pro=eu|fr nur für Tests/Screens. */
// Beim Laden festhalten, bevor die Karte die URL umschreibt.
const INITIAL_SEARCH = typeof location !== "undefined" ? location.search : "";
export function pickVariant(search: string = INITIAL_SEARCH): ProVariant {
  const q = new URLSearchParams(search).get("pro");
  if (q === "fr") return "frankreich";
  if (q === "eu") return "europa";
  return Math.random() < 0.5 ? "europa" : "frankreich";
}

let pageVariant: ProVariant | null = null;
export function variantForThisPage(): ProVariant {
  return (pageVariant ??= pickVariant());
}

export function endDateLabel(lang: string): string {
  const [y, m, d] = PRO_TEST.endDate.split("-");
  return lang === "de" ? `${d}.${m}.${y}` : `${d}/${m}/${y}`;
}
