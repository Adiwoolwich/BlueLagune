import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MetricStore, handleMetric, allowMetric, METRIC_RL_LIMITS, METRIC_RL_PREFIX } from "../worker/metrics";
import { VisitorStore, type KV } from "../worker/visitors";
import { de, en } from "../src/lib/i18n";

function mem(): KV & { data: Map<string, unknown>; alarms: number[] } {
  const data = new Map<string, unknown>();
  const alarms: number[] = [];
  return {
    data, alarms,
    async get<T>(k: string) { return data.get(k) as T | undefined; },
    async put(k: string, v: unknown) { data.set(k, v); },
    async delete(k: string | string[]) { for (const x of [k].flat()) data.delete(x); return true; },
    async list<T>(o: { prefix: string }) { return new Map([...data].filter(([k]) => k.startsWith(o.prefix))) as Map<string, T>; },
    async setAlarm(t: number) { alarms.push(t); },
  };
}
const req = (b: string) => new Request("https://visitors/metric", { method: "POST", body: b });
const CHIP = '{"e":"pro_chip_seen","v":"eu"}';
const INT = '{"e":"pro_interest","v":"fr"}';

describe("/api/metric – Rate-Limit pro Tages-Hash (st:rl:mt:, wie feedback-rl)", () => {
  it("Limits: Chip 3×, Interesse 1× pro Hash und Tag", () => expect(METRIC_RL_LIMITS).toEqual({ pro_chip_seen: 3, pro_interest: 1 }));

  it("unter Limit 204 und gezählt, über Limit 429 und Zähler unverändert", async () => {
    const kv = mem(); const now = () => Date.parse("2026-10-30T10:00:00Z");
    const store = new MetricStore(kv, now);
    const vs = new VisitorStore(kv, now);
    const hash = await vs.hash("203.0.113.9");
    const rl = { kv, hash };
    for (let i = 0; i < 3; i++) expect((await handleMetric(req(CHIP), {}, store, rl)).status).toBe(204);
    expect((await handleMetric(req(CHIP), {}, store, rl)).status).toBe(429);
    expect((await handleMetric(req(INT), {}, store, rl)).status).toBe(204);
    expect((await handleMetric(req(INT), {}, store, rl)).status).toBe(429);
    expect(kv.data.get("m:2026-10-30")).toEqual({ "pro_chip_seen:eu": 3, "pro_interest:fr": 1 });
    expect(kv.data.get(`${METRIC_RL_PREFIX}${hash}`)).toEqual({ pro_chip_seen: 3, pro_interest: 1 });
    // anderer Client (anderer Hash) zählt weiter
    const other = await vs.hash("198.51.100.4");
    expect((await handleMetric(req(INT), {}, store, { kv, hash: other })).status).toBe(204);
    expect((kv.data.get("m:2026-10-30") as Record<string, number>)["pro_interest:fr"]).toBe(2);
    // ungültiger Body zählt nicht ins Limit
    expect((await handleMetric(req('{"e":"x","v":"eu"}'), {}, store, { kv, hash: other })).status).toBe(400);
  });

  it("ohne Hash (kein Salt/IP) wie feedback-rl: erlaubt, kein Marker", async () => {
    const kv = mem();
    expect(await allowMetric(kv, null, "pro_interest")).toBe(true);
    expect(await allowMetric(kv, "nicht-hex", "pro_interest")).toBe(true);
    expect([...kv.data.keys()].filter((k) => k.startsWith(METRIC_RL_PREFIX))).toEqual([]);
  });

  it("Reset: DO-Alarm 00:00 UTC (purge) löscht st:rl:mt:, Aggregate bleiben; Alarm wird weiter gesetzt", async () => {
    const kv = mem(); let t = Date.parse("2026-10-30T23:00:00Z"); const now = () => t;
    const store = new MetricStore(kv, now); const vs = new VisitorStore(kv, now);
    const hash = await vs.hash("203.0.113.9");
    expect(kv.alarms).toEqual([Date.parse("2026-10-31T00:00:00Z")]);
    await handleMetric(req(INT), {}, store, { kv, hash });
    expect((await handleMetric(req(INT), {}, store, { kv, hash })).status).toBe(429);
    t = Date.parse("2026-10-31T00:00:01Z");
    await vs.purge(); // = VisitorCounter.alarm()
    expect([...kv.data.keys()].some((k) => k.startsWith(METRIC_RL_PREFIX))).toBe(false);
    expect(kv.data.get("m:2026-10-30")).toEqual({ "pro_interest:fr": 1 });
    const fresh = await vs.hash("203.0.113.9");
    expect(fresh).not.toBe(hash);
    expect((await handleMetric(req(INT), {}, store, { kv, hash: fresh })).status).toBe(204);
  });

  it("Rückfall ohne Alarm: neuer Salt in salt() purgt st:rl:mt: ebenfalls", async () => {
    const kv = mem(); let t = Date.parse("2026-10-30T12:00:00Z"); const vs = new VisitorStore(kv, () => t);
    const hash = await vs.hash("203.0.113.9");
    await allowMetric(kv, hash, "pro_interest");
    t = Date.parse("2026-10-31T08:00:00Z");
    await vs.hash("203.0.113.9");
    expect(kv.data.has(`${METRIC_RL_PREFIX}${hash}`)).toBe(false);
    expect(METRIC_RL_PREFIX.startsWith("st:rl:")).toBe(true);
  });

  it("Worker: Hash nur vom Worker gesetzt (hashedIp), Alarm bleibt", () => {
    const w = readFileSync("worker.ts", "utf8");
    expect(w).toMatch(/await hashedIp\(env, request\.headers\.get\("CF-Connecting-IP"\)\)/);
    expect(w).toMatch(/headers\["x-bl-rl-hash"\] = rlHash/);
    expect(w).toMatch(/async alarm\(\): Promise<void> \{\n\s+await new VisitorStore\(this\.state\.storage as unknown as KV\)\.purge\(\);/);
  });
});

describe("DSE DE/EN: Pro-Absatz Tages-Hash, Nominatim", () => {
  it("privacyProP nennt kurzlebigen Tages-Hash, nicht mehr „keinen Hash“", () => {
    expect(de.privacyProP).not.toContain("keinen Hash");
    expect(de.privacyProP).toContain("Nur zur Missbrauchsbegrenzung bilden wir einen kurzlebigen Tages-Hash deiner IP-Adresse (mit täglich wechselndem Zufallswert); er wird täglich um 00:00 UTC gelöscht.");
    expect(en.privacyProP).not.toMatch(/IP address, hash,/);
    expect(en.privacyProP).toContain("Only to limit abuse, we create a short-lived daily hash of your IP address (with a random value that changes daily); it is deleted every day at 00:00 UTC.");
  });
  it("privacyGeoP nach Verify-Vorschlag (OSMF UK, Text + IP, Rechtsgrundlage)", () => {
    expect(de.privacyGeoP).toBe("Wenn du einen Ort oder eine PLZ eingibst oder die Karte verschiebst bzw. deinen Standort anzeigst, sendet dein Browser den eingegebenen Text bzw. die Koordinaten der Kartenmitte (nach Tippen auf „Standort“ also ungefähr deinen Standort) und deine IP-Adresse an Nominatim der OpenStreetMap Foundation (Vereinigtes Königreich, Angemessenheitsbeschluss). Zweck: Ortsnamen finden. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.");
    expect(en.privacyGeoP).toBe("When you enter a place or postcode, or move the map or show your location, your browser sends the text you entered or the coordinates of the map centre (after tapping “Location”, roughly your own location) and your IP address to Nominatim of the OpenStreetMap Foundation (United Kingdom, adequacy decision). Purpose: finding place names. Legal basis: Art. 6(1)(f) GDPR.");
    expect(readFileSync("src/components/shell/konzept1.tsx", "utf8")).toMatch(/an OSM Nominatim/);
  });
});
