import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { VisitorStore, isoWeek, handleAdmin, nextUtcMidnight, type KV } from "../worker/visitors";

function mem(): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(k: string) { return data.get(k) as T | undefined; },
    async put(k: string, v: unknown) { data.set(k, v); },
    async delete(k: string | string[]) { for (const x of [k].flat()) data.delete(x); return true; },
    async list<T>(o: { prefix: string }) { return new Map([...data].filter(([k]) => k.startsWith(o.prefix))) as Map<string, T>; },
  };
}
const at = (iso: string) => () => new Date(iso).getTime();

describe("VisitorCounter: rotierender Tages-Salt, nur Aggregate", () => {
  it("Salt wechselt am Tageswechsel (UTC) und bleibt innerhalb des Tages gleich", async () => {
    const kv = mem();
    let now = at("2026-10-30T10:00:00Z");
    const s = new VisitorStore(kv, () => now());
    const a = await s.salt();
    now = at("2026-10-30T23:59:00Z");
    expect(await s.salt()).toBe(a);
    now = at("2026-10-31T00:00:01Z");
    const b = await s.salt();
    expect(b).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("alte Hashes, Rate-Limit-Hashes und alte Salts sind nach Tageswechsel gelöscht", async () => {
    const kv = mem();
    let now = at("2026-10-30T10:00:00Z");
    const s = new VisitorStore(kv, () => now());
    await s.visit("1.2.3.4");
    await kv.put("fb:" + "a".repeat(64), { n: 1, t: 0 });
    await kv.put("st:rl:" + "b".repeat(64), { n: 1, t: 0 });
    await kv.put("st:station-1", { status: "ok", at: 0 });
    const oldSalt = await s.salt();
    now = at("2026-10-31T08:00:00Z");
    await s.visit("5.6.7.8");
    const keys = [...kv.data.keys()];
    expect(keys.filter((k) => k.startsWith("seen:2026-10-30"))).toEqual([]);
    expect(keys.some((k) => k.startsWith("fb:") || k.startsWith("st:rl:"))).toBe(false);
    expect(keys).toContain("st:station-1");
    expect(JSON.stringify([...kv.data.values()])).not.toContain(oldSalt);
  });

  it("speichert keine IP, keinen UA – nur Hash-Marker des Tages und Zahlen", async () => {
    const kv = mem();
    const s = new VisitorStore(kv, at("2026-10-30T10:00:00Z"));
    await s.visit("203.0.113.9");
    const dump = JSON.stringify([...kv.data]);
    expect(dump).not.toContain("203.0.113.9");
    for (const k of kv.data.keys()) expect(k).toMatch(/^(salt|count|d:\d{4}-\d{2}-\d{2}|seen:\d{4}-\d{2}-\d{2}:[0-9a-f]{64})$/);
  });

  it("Tages- und Wochensummen: Besuche und eindeutige Besucher pro Tag", async () => {
    const kv = mem();
    let now = at("2026-10-26T09:00:00Z"); // Mo, KW 44
    const s = new VisitorStore(kv, () => now());
    await s.visit("1.1.1.1"); await s.visit("1.1.1.1"); await s.visit("2.2.2.2");
    now = at("2026-10-27T09:00:00Z");
    await s.visit("1.1.1.1");
    now = at("2026-11-02T09:00:00Z"); // Mo, KW 45
    await s.visit("3.3.3.3");
    expect(await kv.get("d:2026-10-26")).toEqual({ visits: 3, uniques: 2 });
    const weeks = await s.weeks();
    expect(weeks).toEqual([
      { week: "2026-W44", visits: 4, uniques: 3 },
      { week: "2026-W45", visits: 1, uniques: 1 },
    ]);
  });

  it("isoWeek: Jahreswechsel korrekt", () => {
    expect(isoWeek("2026-12-31")).toBe("2026-W53");
    expect(isoWeek("2027-01-04")).toBe("2027-W01");
  });

  it("kein Fallback-Salt 'bluelagune' mehr im Worker", () => {
    const src = readFileSync("worker.ts", "utf8") + readFileSync("worker/visitors.ts", "utf8");
    expect(src).not.toMatch(/["']bluelagune["']/);
  });

  it("kein Client-Zählaufruf: App ruft /api/visitors höchstens lesend für die Anzeige", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app.match(/fetch\("\/api\/visitors"\)/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe("Auswertung /admin/besuche", () => {
  const kv = mem();
  const store = new VisitorStore(kv, at("2026-10-30T10:00:00Z"));
  it("ohne Berechtigung 401/403, ohne Set-Cookie", async () => {
    for (const env of [{}, { ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com", ACCESS_AUD: "aud" }]) {
      const r = await handleAdmin(new Request("https://blue-lagune.com/admin/besuche"), env, store);
      expect([401, 403]).toContain(r.status);
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });
  it("gefälschtes Access-Token wird abgelehnt", async () => {
    const req = new Request("https://blue-lagune.com/admin/besuche", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } });
    const r = await handleAdmin(req, { ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com", ACCESS_AUD: "aud" }, store, async () => ({ keys: [] }));
    expect([401, 403]).toContain(r.status);
  });
  it("mit gültigem Access-Token: Tabelle Besuche pro Woche, keine Cookies", async () => {
    const { token, jwks } = await signTestJwt("aud", "https://x.cloudflareaccess.com");
    const req = new Request("https://blue-lagune.com/admin/besuche", { headers: { "Cf-Access-Jwt-Assertion": token } });
    await store.visit("9.9.9.9");
    const r = await handleAdmin(req, { ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com", ACCESS_AUD: "aud" }, store, async () => jwks, at("2026-10-30T10:00:00Z"));
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toBeNull();
    const html = await r.text();
    expect(html).toContain("2026-W44");
    expect(html).toContain("<table");
  });
});

async function signTestJwt(aud: string, iss: string) {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", kp.publicKey)), kid: "k1", alg: "RS256" };
  const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
  const enc = (o: unknown) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const now = Math.floor(new Date("2026-10-30T10:00:00Z").getTime() / 1000);
  const data = `${enc({ alg: "RS256", kid: "k1" })}.${enc({ aud: [aud], iss, exp: now + 600, iat: now })}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.privateKey, new TextEncoder().encode(data));
  return { token: `${data}.${b64(sig)}`, jwks: { keys: [jwk] } };
}

describe("Altbestand", () => {
  it("alter Dauer-Salt und h:-Hashes werden beim ersten Lauf gelöscht, count bleibt", async () => {
    const kv = mem();
    await kv.put("salt", "f".repeat(64)); await kv.put("h:" + "c".repeat(64), 1); await kv.put("count", 7);
    const s = new VisitorStore(kv, at("2026-10-30T10:00:00Z"));
    await s.visit("1.2.3.4");
    expect([...kv.data.keys()].some((k) => k.startsWith("h:"))).toBe(false);
    expect(JSON.stringify([...kv.data.values()])).not.toContain("f".repeat(64));
    expect(await kv.get("count")).toBe(8);
  });
});

describe("Verfall der Tageshashes bis Mitternacht (Alarm statt expirationTtl)", () => {
  it("salt() setzt den Alarm auf die nächste UTC-Mitternacht", async () => {
    const kv = mem();
    const alarms: number[] = [];
    kv.setAlarm = async (t: number) => void alarms.push(t);
    const s = new VisitorStore(kv, at("2026-10-30T22:15:00Z"));
    await s.visit("1.2.3.4");
    expect(alarms).toEqual([Date.UTC(2026, 9, 31)]);
    expect(nextUtcMidnight(Date.UTC(2026, 11, 31, 23, 59))).toBe(Date.UTC(2027, 0, 1));
  });
  it("purge() (Alarm) löscht seen:/fb:/st:rl: und Salt ohne Folgeaufruf, Aggregate bleiben", async () => {
    const kv = mem();
    const s = new VisitorStore(kv, at("2026-10-30T10:00:00Z"));
    await s.visit("1.2.3.4");
    await kv.put("fb:" + "a".repeat(64), { n: 1, t: 0 });
    await kv.put("st:rl:" + "b".repeat(64), { n: 1, t: 0 });
    await kv.put("st:station-1", { status: "ok", at: 0 });
    await s.purge();
    const keys = [...kv.data.keys()].sort();
    expect(keys).toEqual(["count", "d:2026-10-30", "st:station-1"]);
  });
});
