/**
 * Besuchszählung nur serverseitig (ohne Cookies, ohne localStorage, ohne Client-Skript, ohne Verweildauer).
 * - Eindeutige Besucher pro Tag über SHA-256(Tages-Salt + IP). Der Salt ist zufällig, gilt einen UTC-Tag
 *   und wird beim Tageswechsel ersetzt; dabei werden alle Hash-Marker (seen:, fb:, st:rl:) gelöscht.
 *   Verfall automatisch: beim Anlegen des Salts wird ein Alarm auf die nächste UTC-Mitternacht gesetzt
 *   (Durable Objects kennen kein KV-expirationTtl); alarm() → purge(). Das Löschen beim ersten Aufruf bleibt als Rückfall.
 *   Es bleibt also kein dauerhafter IP-Hash. IP und User-Agent werden nie gespeichert.
 * - Gespeichert bleiben nur Aggregate: d:<Tag> = { visits, uniques } und count (Summe eindeutiger Tagesbesucher).
 */
export type KV = {
  get<T>(k: string): Promise<T | undefined>;
  put(k: string, v: unknown): Promise<void>;
  delete(k: string | string[]): Promise<unknown>;
  list<T>(o: { prefix: string }): Promise<Map<string, T>>;
  /** Durable-Object-Storage hat kein expirationTtl; stattdessen Alarm bis Mitternacht (UTC). */
  setAlarm?(scheduledTime: number): Promise<void>;
};
type Day = { visits: number; uniques: number };
export type Week = { week: string; visits: number; uniques: number };

// "h:" = dauerhafte IP-Hashes aus dem Altstand; werden beim ersten Lauf mitgelöscht.
const HASH_PREFIXES = ["seen:", "fb:", "st:rl:", "h:"];

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7; // Mo=0
  d.setUTCDate(d.getUTCDate() - wd + 3); // Donnerstag der Woche
  const year = d.getUTCFullYear();
  const week = 1 + Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Nächste UTC-Mitternacht (ms) – Verfallszeit der Tageshashes. */
export function nextUtcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class VisitorStore {
  constructor(private kv: KV, private now: () => number = Date.now) {}

  /** Aktueller Tages-Salt; beim Tageswechsel neu erzeugt, alte Hashes werden gelöscht. */
  async salt(): Promise<string> {
    const day = utcDay(this.now());
    const cur = await this.kv.get<{ day: string; value: string }>("salt");
    if (cur && cur.day === day) return cur.value;
    await this.purgeHashes();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const value = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await this.kv.put("salt", { day, value });
    await this.kv.setAlarm?.(nextUtcMidnight(this.now()));
    return value;
  }

  private async purgeHashes(): Promise<void> {
    for (const p of HASH_PREFIXES) {
      const keys = [...(await this.kv.list({ prefix: p })).keys()];
      for (let i = 0; i < keys.length; i += 128) await this.kv.delete(keys.slice(i, i + 128));
    }
  }

  /** Alarm um Mitternacht (UTC): alle Tageshashes und den Salt verwerfen; Aggregate bleiben. */
  async purge(): Promise<void> {
    await this.purgeHashes();
    await this.kv.delete("salt");
  }

  /** Tageshash der IP (nur für Zählung/Rate-Limit am selben Tag). */
  async hash(ip: string): Promise<string> {
    return sha256Hex(`${await this.salt()}\n${ip}`);
  }

  async visit(ip: string | null): Promise<void> {
    const day = utcDay(this.now());
    const rec = (await this.kv.get<Day>(`d:${day}`)) ?? { visits: 0, uniques: 0 };
    rec.visits += 1;
    if (ip) {
      const key = `seen:${day}:${await this.hash(ip)}`;
      if (!(await this.kv.get(key))) {
        await this.kv.put(key, 1);
        rec.uniques += 1;
        await this.kv.put("count", ((await this.kv.get<number>("count")) ?? 0) + 1);
      }
    }
    await this.kv.put(`d:${day}`, rec);
  }

  async count(): Promise<number> {
    return (await this.kv.get<number>("count")) ?? 0;
  }

  async weeks(): Promise<Week[]> {
    const days = await this.kv.list<Day>({ prefix: "d:" });
    const out = new Map<string, Week>();
    for (const [k, v] of days) {
      const w = isoWeek(k.slice(2));
      const cur = out.get(w) ?? { week: w, visits: 0, uniques: 0 };
      cur.visits += v.visits;
      cur.uniques += v.uniques;
      out.set(w, cur);
    }
    return [...out.values()].sort((a, b) => a.week.localeCompare(b.week));
  }
}

/* ---------- Auswertung /admin/besuche, geschützt per Cloudflare Access (JWT) ---------- */

export type AdminEnv = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string };
type Jwks = { keys: (JsonWebKey & { kid?: string })[] };

const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function verifyAccessJwt(token: string, env: Required<AdminEnv>, jwks: Jwks, nowMs: number): Promise<boolean> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return false;
    const header = JSON.parse(new TextDecoder().decode(b64u(h))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(b64u(p))) as { aud?: string | string[]; iss?: string; exp?: number };
    if (header.alg !== "RS256") return false;
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return false;
    const aud = [claims.aud].flat();
    if (!aud.includes(env.ACCESS_AUD)) return false;
    if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return false;
    return typeof claims.exp === "number" && claims.exp * 1000 > nowMs;
  } catch {
    return false;
  }
}

const deny = (status: 401 | 403, msg: string) =>
  new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function handleAdmin(
  request: Request,
  env: AdminEnv,
  store: VisitorStore,
  fetchJwks: (url: string) => Promise<Jwks> = async (u) => (await fetch(u)).json() as Promise<Jwks>,
  now: () => number = Date.now,
): Promise<Response> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return deny(403, "Auswertung gesperrt: Zugriffsschutz (Cloudflare Access) ist nicht eingerichtet.");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return deny(401, "Anmeldung erforderlich.");
  const cfg = { ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN, ACCESS_AUD: env.ACCESS_AUD };
  let jwks: Jwks;
  try {
    jwks = await fetchJwks(`https://${cfg.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  } catch {
    return deny(403, "Zugriff konnte nicht geprüft werden.");
  }
  if (!(await verifyAccessJwt(token, cfg, jwks, now()))) return deny(403, "Kein Zugriff.");
  const weeks = await store.weeks();
  const max = Math.max(1, ...weeks.map((w) => w.visits));
  const rows = weeks
    .map((w) => `<tr><td>${w.week}</td><td>${w.visits}</td><td>${w.uniques}</td><td><span style="display:inline-block;height:10px;background:#3e6ae1;width:${Math.round((w.visits / max) * 200)}px"></span></td></tr>`)
    .join("");
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Besuche pro Woche</title>
<body style="font:14px system-ui,sans-serif;margin:24px;color:#171a20"><h1 style="font-size:18px">Besuche pro Woche</h1>
<p>Nur serverseitige Summen (ISO-Woche, UTC). Eindeutige Besucher = Summe der eindeutigen Tagesbesucher.</p>
<table style="border-collapse:collapse" cellpadding="6"><thead><tr><th align="left">Woche</th><th align="left">Besuche</th><th align="left">Eindeutig/Tag (Summe)</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4">Noch keine Daten.</td></tr>'}</tbody></table></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
