/** Anonymer Zähler (nur Ereignis + Variante). Kein Cookie, kein Speicher, keine Kennung. */
import { proActive, type ProVariant } from "@/lib/pro-test";

export type ProEvent = "pro_chip_seen" | "pro_interest";
const short = (v: ProVariant) => (v === "frankreich" ? "fr" : "eu");

export function sendProMetric(e: ProEvent, v: ProVariant): void {
  if (!proActive()) return;
  try {
    void fetch("/api/metric", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ e, v: short(v) }),
    }).catch(() => undefined);
  } catch {
    /* Zählen ist nie wichtiger als die Karte */
  }
}

let chipSeen = false;
/** Höchstens einmal pro Seitenaufruf (nur im Arbeitsspeicher). */
export function chipSeenOnce(v: ProVariant): void {
  if (chipSeen) return;
  chipSeen = true;
  sendProMetric("pro_chip_seen", v);
}
