/**
 * Anonymer Zähler für den Pro-Europa-Test (POST /api/metric).
 * Gespeichert wird ausschließlich m:<UTC-Tag> = { "<ereignis>:<variante>": Anzahl }.
 * Keine IP, kein Hash, kein Salt, kein Cookie, keine Kennung, keine Header, kein Referrer.
 */
import { handleAdmin, utcDay, type AdminEnv, type KV, type VisitorStore } from "./visitors";

export type FetchJwks = NonNullable<Parameters<typeof handleAdmin>[3]>;
/** Access-Prüfung wie /admin/besuche: nutzt MACROHards handleAdmin unverändert (visitors.ts nicht angefasst).
 * null = erlaubt, sonst dessen Ablehnung (401/403). Die Besuchsseite selbst wird verworfen. */
async function checkAccess(request: Request, env: AdminEnv, fetchJwks?: FetchJwks, now?: () => number): Promise<Response | null> {
  const noWeeks = { weeks: async () => [] } as unknown as VisitorStore;
  const res = await handleAdmin(request, env, noWeeks, fetchJwks, now);
  return res.status === 200 ? null : res;
}

export const METRIC_EVENTS = new Set(["pro_chip_seen", "pro_interest"]);
export const METRIC_VARIANTS = new Set(["eu", "fr"]);
const MAX_BODY = 64;

export type MetricEnv = AdminEnv & { PRO_TEST?: string };
type Counts = Record<string, number>;

/** Globale Obergrenze pro UTC-Tag, Ereignis und Variante (ohne IP). Darüber: still 204, nicht weiter zählen. */
export const METRIC_DAILY_CAP = 5000;

export class MetricStore {
  constructor(private kv: KV, private now: () => number = Date.now) {}
  async add(event: string, variant: string): Promise<void> {
    const key = `m:${utcDay(this.now())}`;
    const rec = (await this.kv.get<Counts>(key)) ?? {};
    const k = `${event}:${variant}`;
    if ((rec[k] ?? 0) >= METRIC_DAILY_CAP) return;
    rec[k] = (rec[k] ?? 0) + 1;
    await this.kv.put(key, rec);
  }
  async days(): Promise<{ day: string; counts: Counts }[]> {
    const all = await this.kv.list<Counts>({ prefix: "m:" });
    return [...all].map(([k, counts]) => ({ day: k.slice(2), counts })).sort((a, b) => a.day.localeCompare(b.day));
  }
}

/** Rate-Limit pro Tages-Hash (wie feedback-rl/st:rl:): Schlüssel st:rl:mt:<hash> (vom bestehenden 00:00-UTC-Alarm über st:rl: gelöscht), gleicher hashedIp/Salt.
 *  Gelöscht vom bestehenden DO-Alarm 00:00 UTC (Präfix st:rl: in HASH_PREFIXES, visitors.ts unverändert) bzw. Rückfall beim Salt-Wechsel.
 *  Grenzen je Hash und UTC-Tag: Chip gesehen 3× (mehrere Seitenaufrufe sind normal), Interesse 1× (eine Person = eine Stimme). */
export const METRIC_RL_PREFIX = "st:rl:mt:";
export const METRIC_RL_LIMITS: Record<string, number> = { pro_chip_seen: 3, pro_interest: 1 };
const HASH_RE = /^[0-9a-f]{64}$/;

/** true = zählen erlaubt (Zähler im Marker wird erhöht); false = Limit erreicht, nichts erhöhen. Ohne gültigen Hash: erlaubt (wie feedback-rl). */
export async function allowMetric(kv: KV, hash: string | null | undefined, event: string): Promise<boolean> {
  if (!hash || !HASH_RE.test(hash)) return true;
  const key = `${METRIC_RL_PREFIX}${hash}`;
  const rec = (await kv.get<Counts>(key)) ?? {};
  const n = rec[event] ?? 0;
  if (n >= (METRIC_RL_LIMITS[event] ?? 1)) return false;
  rec[event] = n + 1;
  await kv.put(key, rec);
  return true;
}

export const proTestOn = (env: MetricEnv) => env.PRO_TEST !== "off";

const plain = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/** Prüft nur den Body; liefert [ereignis, variante] oder null. */
export function parseMetric(body: string): [string, string] | null {
  if (!body || body.length > MAX_BODY) return null;
  let o: unknown;
  try { o = JSON.parse(body); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const keys = Object.keys(o);
  if (keys.length !== 2 || !keys.includes("e") || !keys.includes("v")) return null;
  const { e, v } = o as { e: unknown; v: unknown };
  if (typeof e !== "string" || typeof v !== "string" || !METRIC_EVENTS.has(e) || !METRIC_VARIANTS.has(v)) return null;
  return [e, v];
}

/** rl: optional { kv, hash } – Tages-Hash vom Worker (hashedIp); bei Limit 429, Tageszähler bleibt unverändert. */
export async function handleMetric(request: Request, env: MetricEnv, store: MetricStore, rl?: { kv: KV; hash: string | null }): Promise<Response> {
  if (!proTestOn(env)) return plain(404);
  if (request.method !== "POST") return plain(405);
  const len = Number(request.headers.get("Content-Length") ?? "0");
  if (len > MAX_BODY) return plain(400);
  const parsed = parseMetric((await request.text()).slice(0, MAX_BODY + 1));
  if (!parsed) return plain(400);
  if (rl && !(await allowMetric(rl.kv, rl.hash, parsed[0]))) return plain(429);
  await store.add(parsed[0], parsed[1]);
  return plain(204);
}

export async function handleMetricAdmin(request: Request, env: MetricEnv, store: MetricStore, fetchJwks?: FetchJwks, now?: () => number): Promise<Response> {
  const denied = await checkAccess(request, env, fetchJwks, now);
  if (denied) return denied;
  const cols = ["pro_chip_seen:eu", "pro_interest:eu", "pro_chip_seen:fr", "pro_interest:fr"];
  const rows = (await store.days())
    .map(({ day, counts }) => `<tr><td>${day}</td>${cols.map((c) => `<td>${counts[c] ?? 0}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Pro-Europa-Test</title>
<body style="font:14px system-ui,sans-serif;margin:24px"><h1 style="font-size:18px">Pro-Europa-Test – Tagessummen (UTC)</h1>
<table cellpadding="6"><thead><tr><th>Tag</th><th>Chip gesehen EU</th><th>Interesse EU</th><th>Chip gesehen FR</th><th>Interesse FR</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Noch keine Daten.</td></tr>'}</tbody></table></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
