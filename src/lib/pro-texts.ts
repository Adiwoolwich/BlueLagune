/** Texte nach Saul (business/bluelagune-testseite-pro-europa-20261030.md), Pflichtformulierungen nach Lead/Lex. EN/NL: Übersetzung Build. */
type T = {
  chip: string; detail: string; headline: { europa: string; frankreich: string };
  benefits: { europa: string[]; frankreich: string[] };
  price: string; preview: string; honest: string; cta: string; thanks: string; until: string; close: string;
  faq: [string, string][];
};
const de: T = {
  chip: "Pro Europa · Vorschau",
  detail: "Status-Warnung für diese Route? → Pro Europa",
  headline: { europa: "Entsorgen ohne böse Überraschung – in ganz Europa.", frankreich: "Frankreichs Aires de services auf deiner Karte" },
  benefits: {
    europa: [
      "🗺️ Geplant – Europa-Karte: Entsorgungsstationen über Deutschland und die Niederlande hinaus, zum Beispiel in Frankreich, Italien und Spanien.",
      "🔔 Geplant – Live-Status-Push: Eine Warnung, wenn eine Station auf deiner Route als defekt, geschlossen oder kostenpflichtig gemeldet wird.",
      "🤝 Defektmeldungen bleiben gratis: Melden kann jeder, auch ohne Pro. Jede Meldung hilft allen.",
    ],
    frankreich: [
      "🗺️ Geplant – Frankreich-Karte: Aires de services und Entsorgungsstationen in ganz Frankreich.",
      "🔔 Geplant – Live-Status-Push: Eine Warnung, wenn eine Station auf deiner Route als defekt, geschlossen oder kostenpflichtig gemeldet wird.",
      "🤝 Defektmeldungen bleiben gratis: Melden kann jeder, auch ohne Pro. Jede Meldung hilft allen.",
    ],
  },
  price: "9,99 € pro Jahr inkl. MwSt.",
  preview: "Vorschau – noch nicht erhältlich, nichts wird berechnet",
  honest: "Pro Europa gibt es noch nicht. Wir prüfen gerade, ob genug Camper es wollen. Heute wird nichts berechnet, und du gehst keine Verpflichtung ein. Deutschland und die Niederlande bleiben kostenlos.",
  cta: "Interesse zeigen",
  thanks: "Danke! Wir zählen nur anonym mit, wie viele Interesse haben – nichts über dich.",
  until: "Test läuft bis {date}.",
  close: "Schließen",
  faq: [
    ["Kostet das jetzt etwas?", "Nein. Es gibt noch keine Zahlung und kein Konto."],
    ["Bleibt BlueLagune kostenlos?", "Ja. Karte, Suche, Details und Melden in DE + NL bleiben frei."],
    ["Wann kommt Pro?", "Das hängt von diesem Test ab. Ein Datum gibt es noch nicht."],
    ["Welche Länder?", "Geplant ist Europa. Die Reihenfolge der Länder ist noch offen."],
    ["Was speichert ihr?", "Nur anonyme Tagessummen, nichts Persönliches."],
  ],
};
const en: T = {
  chip: "Pro Europa · Preview",
  detail: "Status alerts for this route? → Pro Europa",
  headline: { europa: "Dump stations without nasty surprises – all over Europe.", frankreich: "France's aires de services on your map" },
  benefits: {
    europa: [
      "🗺️ Planned – Europe map: dump stations beyond Germany and the Netherlands, for example in France, Italy and Spain.",
      "🔔 Planned – live status push: an alert when a station on your route is reported broken, closed or paid.",
      "🤝 Reports stay free: anyone can report, even without Pro. Every report helps everyone.",
    ],
    frankreich: [
      "🗺️ Planned – France map: aires de services and dump stations all over France.",
      "🔔 Planned – live status push: an alert when a station on your route is reported broken, closed or paid.",
      "🤝 Reports stay free: anyone can report, even without Pro. Every report helps everyone.",
    ],
  },
  price: "€9.99 per year incl. VAT",
  preview: "Preview – not yet available, nothing will be charged",
  honest: "Pro Europa doesn't exist yet. We're checking whether enough campers want it. Nothing is charged today and you make no commitment. Germany and the Netherlands stay free.",
  cta: "Show interest",
  thanks: "Thanks! We only count anonymously how many people are interested – nothing about you.",
  until: "Test runs until {date}.",
  close: "Close",
  faq: [
    ["Does this cost anything now?", "No. There is no payment and no account yet."],
    ["Will BlueLagune stay free?", "Yes. Map, search, details and reports in DE + NL stay free."],
    ["When is Pro coming?", "That depends on this test. There is no date yet."],
    ["Which countries?", "Europe is planned. The order of countries is still open."],
    ["What do you store?", "Only anonymous daily totals, nothing personal."],
  ],
};
// User-Entscheid 30.10. 12:42: Pro Europa nur Deutsch und Englisch; NL-Nutzer sehen Englisch.
export const PRO_TEXT = { de, en };
export function proText(lang: string): T {
  return lang === "de" ? de : en;
}
