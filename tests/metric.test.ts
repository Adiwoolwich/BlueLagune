import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { MetricStore, handleMetric, handleMetricAdmin, METRIC_EVENTS, METRIC_DAILY_CAP } from "../worker/metrics";
import type { KV } from "../worker/visitors";

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
const req = (body: string, init: RequestInit = {}) =>
  new Request("https://blue-lagune.com/api/metric", {
    method: "POST", body,
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.77", "User-Agent": "UA-Geheim/1.0", Cookie: "sid=keks123", Referer: "https://blue-lagune.com/?c=1" },
    ...init,
  });

describe("/api/metric – nur anonyme Tagessummen", () => {
  it("Allowlist: genau zwei Ereignisse, Varianten eu/fr", () => {
    expect([...METRIC_EVENTS].sort()).toEqual(["pro_chip_seen", "pro_interest"]);
  });

  it("zählt Ereignis je Variante als Tagesaggregat", async () => {
    const kv = mem(); const s = new MetricStore(kv, at("2026-10-30T10:00:00Z"));
    for (const b of ['{"e":"pro_chip_seen","v":"eu"}', '{"e":"pro_chip_seen","v":"eu"}', '{"e":"pro_chip_seen","v":"fr"}', '{"e":"pro_interest","v":"fr"}']) {
      expect((await handleMetric(req(b), {}, s)).status).toBe(204);
    }
    expect([...kv.data.keys()]).toEqual(["m:2026-10-30"]);
    expect(kv.data.get("m:2026-10-30")).toEqual({ "pro_chip_seen:eu": 2, "pro_chip_seen:fr": 1, "pro_interest:fr": 1 });
  });

  it("neuer Tag = neuer Schlüssel, keine Einzelereignisse", async () => {
    const kv = mem(); let now = at("2026-10-30T23:59:00Z"); const s = new MetricStore(kv, () => now());
    await handleMetric(req('{"e":"pro_interest","v":"eu"}'), {}, s);
    now = at("2026-10-31T00:01:00Z");
    await handleMetric(req('{"e":"pro_interest","v":"eu"}'), {}, s);
    expect([...kv.data.keys()].sort()).toEqual(["m:2026-10-30", "m:2026-10-31"]);
    expect(await s.days()).toEqual([
      { day: "2026-10-30", counts: { "pro_interest:eu": 1 } },
      { day: "2026-10-31", counts: { "pro_interest:eu": 1 } },
    ]);
  });

  it("speichert keine IP, keinen Header, kein Salt/Hash; setzt kein Cookie", async () => {
    const kv = mem(); const s = new MetricStore(kv, at("2026-10-30T10:00:00Z"));
    const res = await handleMetric(req('{"e":"pro_chip_seen","v":"eu"}'), {}, s);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const dump = JSON.stringify([...kv.data]);
    for (const bad of ["203.0.113.77", "UA-Geheim", "keks123", "blue-lagune.com", "salt"]) expect(dump).not.toContain(bad);
    expect(dump).not.toMatch(/[0-9a-f]{32,}/);
  });

  it("lehnt alles außerhalb der Allowlist mit 400 ab und speichert nichts", async () => {
    const kv = mem(); const s = new MetricStore(kv, at("2026-10-30T10:00:00Z"));
    const bad = [
      '{"e":"pageview","v":"eu"}', '{"e":"pro_interest","v":"de"}', '{"e":"pro_interest"}',
      '{"e":"pro_interest","v":"eu","id":"x"}', "kein json", "", '["pro_interest","eu"]',
      '{"e":"pro_interest","v":"eu","x":"' + "a".repeat(200) + '"}',
    ];
    for (const b of bad) expect((await handleMetric(req(b), {}, s)).status, b).toBe(400);
    expect(kv.data.size).toBe(0);
  });

  it("nur POST", async () => {
    const s = new MetricStore(mem());
    expect((await handleMetric(new Request("https://x/api/metric"), {}, s)).status).toBe(405);
  });

  it("hängt am Schalter PRO_TEST: aus → 404, nichts gespeichert", async () => {
    const kv = mem(); const s = new MetricStore(kv);
    expect((await handleMetric(req('{"e":"pro_interest","v":"eu"}'), { PRO_TEST: "off" }, s)).status).toBe(404);
    expect(kv.data.size).toBe(0);
  });

  it("Abruf geschützt wie /admin/besuche: 403 ohne Access-Variablen", async () => {
    const s = new MetricStore(mem());
    const r = await handleMetricAdmin(new Request("https://x/admin/pro"), {}, s);
    expect(r.status).toBe(403);
    const r2 = await handleMetricAdmin(new Request("https://x/admin/pro"), { ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com", ACCESS_AUD: "aud" }, s, async () => ({ keys: [] }));
    expect(r2.status).toBe(401);
  });

  it("Worker leitet /api/metric und /admin/pro, Salt-Rotation löscht keine m:-Summen", () => {
    const w = execSync("cat worker.ts", { encoding: "utf8" });
    expect(w).toContain('"/api/metric"');
    expect(w).toContain('"/admin/pro"');
    expect(execSync("grep -n 'HASH_PREFIXES = ' worker/visitors.ts", { encoding: "utf8" })).not.toContain("m:");
  });

  it("Client: sendet ohne Cookies, ohne Speicher, nur Ereignis + Variante", () => {
    const src = execSync("cat src/lib/pro-metric.ts", { encoding: "utf8" });
    expect(src).toContain('credentials: "omit"');
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
  it("Rate-Limit: global 5000 pro Tag/Ereignis/Variante, darüber still 204 ohne Zählen, keine IP", async () => {
    expect(METRIC_DAILY_CAP).toBe(5000);
    const kv = mem(); let now = at("2026-10-30T10:00:00Z"); const s = new MetricStore(kv, () => now());
    kv.data.set("m:2026-10-30", { "pro_interest:eu": 4999, "pro_chip_seen:eu": 5000 });
    for (let i = 0; i < 3; i++) {
      const r = await handleMetric(req('{"e":"pro_interest","v":"eu"}'), {}, s);
      expect(r.status).toBe(204);
      expect(r.headers.get("set-cookie")).toBeNull();
    }
    expect((await handleMetric(req('{"e":"pro_chip_seen","v":"eu"}'), {}, s)).status).toBe(204);
    expect((await handleMetric(req('{"e":"pro_interest","v":"fr"}'), {}, s)).status).toBe(204);
    expect(kv.data.get("m:2026-10-30")).toEqual({ "pro_interest:eu": 5000, "pro_chip_seen:eu": 5000, "pro_interest:fr": 1 });
    now = at("2026-10-31T00:01:00Z");
    await handleMetric(req('{"e":"pro_interest","v":"eu"}'), {}, s);
    expect(kv.data.get("m:2026-10-31")).toEqual({ "pro_interest:eu": 1 });
    expect(JSON.stringify([...kv.data])).not.toMatch(/203\.0\.113|UA-Geheim|keks/);
  });
});
