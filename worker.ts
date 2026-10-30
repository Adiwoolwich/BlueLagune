import { EmailMessage } from "cloudflare:email";
import { VisitorStore, handleAdmin, type KV } from "./worker/visitors";

/**
 * Besuchszähler (Durable Object). Nur Tages-/Wochensummen; eindeutige Besucher pro Tag über
 * SHA-256(täglich rotierender Zufalls-Salt + IP). IP/User-Agent werden nie gespeichert,
 * Hash-Marker werden beim Tageswechsel gelöscht (siehe worker/visitors.ts).
 */
export interface Env {
  ASSETS: Fetcher;
  VISITORS: DurableObjectNamespace;
  /** Optional: Cloudflare-Access-Team-Domain und AUD-Tag für /admin/besuche (keine Secrets). */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  EMAIL: {
    send: (message: EmailMessage) => Promise<void>;
  };
}

export class VisitorCounter {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const store = new VisitorStore(this.state.storage as unknown as KV);
    if (url.pathname === "/hash" && request.method === "POST") {
      const ip = (await request.text()).trim();
      if (!ip) return new Response("", { status: 400 });
      return new Response(await store.hash(ip));
    }
    if (url.pathname === "/count") {
      return Response.json({ count: await store.count() });
    }
    if (url.pathname === "/visit" && request.method === "POST") {
      const ip = (await request.text()).trim();
      await store.visit(ip || null);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/admin" && request.method === "GET") {
      const env = JSON.parse(request.headers.get("x-bl-admin-env") || "{}");
      const fwd = new Request(request.url, { headers: request.headers });
      return handleAdmin(fwd, env, store);
    }
    if (url.pathname === "/feedback-rl" && request.method === "POST") {
      const hash = (await request.text()).trim();
      if (!/^[0-9a-f]{64}$/.test(hash)) return Response.json({ ok: true });
      const now = Date.now();
      const key = `fb:${hash}`;
      const rec = await this.state.storage.get<{ n: number; t: number }>(key);
      if (rec && now - rec.t < 60 * 60 * 1000) {
        if (rec.n >= 5) return Response.json({ ok: false }, { status: 429 });
        await this.state.storage.put(key, { n: rec.n + 1, t: rec.t });
      } else {
        await this.state.storage.put(key, { n: 1, t: now });
      }
      return Response.json({ ok: true });
    }
    if (url.pathname === "/report-rl" && request.method === "POST") {
      const hash = (await request.text()).trim();
      if (!/^[0-9a-f]{64}$/.test(hash)) return Response.json({ ok: true });
      const now = Date.now();
      const key = `st:rl:${hash}`;
      const rec = await this.state.storage.get<{ n: number; t: number }>(key);
      if (rec && now - rec.t < 60 * 60 * 1000) {
        if (rec.n >= 5) return Response.json({ ok: false }, { status: 429 });
        await this.state.storage.put(key, { n: rec.n + 1, t: rec.t });
      } else {
        await this.state.storage.put(key, { n: 1, t: now });
      }
      return Response.json({ ok: true });
    }
    if (url.pathname === "/reports" && request.method === "GET") {
      const listed = await this.state.storage.list<StationReport>({ prefix: "st:" });
      const reports: Record<string, StationReport> = {};
      for (const [key, rec] of listed) {
        if (key.startsWith("st:rl:")) continue;
        const id = key.slice(3);
        if (rec && (rec.status === "ok" || rec.status === "broken")) reports[id] = rec;
      }
      return Response.json({ reports });
    }
    if (url.pathname === "/reports" && request.method === "POST") {
      let body: { id?: string; status?: string; note?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      }
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const status = body.status;
      if (!STATION_ID_RE.test(id) || (status !== "ok" && status !== "broken")) {
        return Response.json({ ok: false, error: "invalid" }, { status: 400 });
      }
      let note: string | undefined;
      if (typeof body.note === "string") {
        note = body.note.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
        if (!note) note = undefined;
      }
      const rec: StationReport = { status, at: Date.now() };
      if (note) rec.note = note;
      await this.state.storage.put(`st:${id}`, rec);
      return Response.json({ ok: true, report: rec });
    }
    return new Response("not found", { status: 404 });
  }
}

type StationReport = { status: "ok" | "broken"; note?: string; at: number };

const STATION_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/;


async function readCount(env: Env): Promise<number> {
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  const data = (await (await stub.fetch("https://visitors/count")).json()) as { count: number };
  return data.count ?? 0;
}

async function countVisit(env: Env, ip: string | null): Promise<void> {
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  await stub.fetch("https://visitors/visit", { method: "POST", body: ip ?? "" });
}

function isSitePage(url: URL): boolean {
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/assets/")) return false;
  return !/\.(js|css|png|jpe?g|svg|ico|webp|woff2?|map|json|txt|xml)$/i.test(url.pathname);
}

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://blue-lagune.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://blue-lagune.com/feedback</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://blue-lagune.com/impressum</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://blue-lagune.com/datenschutz</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`;


const FEEDBACK_TO = "woolwichvcc@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "https://blue-lagune.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...corsHeaders() } });
}

function escapeText(s: string): string {
  return s.replace(/\r/g, "").slice(0, 4000);
}

/** Tageshash der IP für Rate-Limits; ohne erreichbaren Salt kein Hash (kein fester Fallback). */
async function hashedIp(env: Env, ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  const res = await stub.fetch("https://visitors/hash", { method: "POST", body: ip });
  return res.ok ? (await res.text()).trim() : null;
}

async function allowFeedback(env: Env, ip: string | null): Promise<boolean> {
  const hash = await hashedIp(env, ip);
  if (!hash) return true;
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  const res = await stub.fetch("https://visitors/feedback-rl", { method: "POST", body: hash });
  return res.ok;
}

async function allowReport(env: Env, ip: string | null): Promise<boolean> {
  const hash = await hashedIp(env, ip);
  if (!hash) return true;
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  const res = await stub.fetch("https://visitors/report-rl", { method: "POST", body: hash });
  return res.ok;
}

async function handleReport(request: Request, env: Env): Promise<Response> {
  let body: { id?: string; status?: string; note?: string; company?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ ok: true });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = body.status;
  if (!STATION_ID_RE.test(id) || (status !== "ok" && status !== "broken")) {
    return json({ ok: false, error: "invalid" }, 400);
  }
  let note: string | undefined;
  if (typeof body.note === "string") {
    note = body.note.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
    if (!note) note = undefined;
  }
  const ip = request.headers.get("CF-Connecting-IP");
  if (!(await allowReport(env, ip))) return json({ ok: false, error: "rate" }, 429);
  const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
  const payload: { id: string; status: "ok" | "broken"; note?: string } = { id, status };
  if (note) payload.note = note;
  const res = await stub.fetch("https://visitors/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return json(data, res.status);
}

async function handleFeedback(request: Request, env: Env): Promise<Response> {
  let body: { name?: string; email?: string; message?: string; company?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ ok: true });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (name.length < 2 || name.length > 80) return json({ ok: false, error: "name" }, 400);
  if (!EMAIL_RE.test(email) || email.length > 120) return json({ ok: false, error: "email" }, 400);
  if (message.length < 10 || message.length > 4000) return json({ ok: false, error: "message" }, 400);

  const ip = request.headers.get("CF-Connecting-IP");
  if (!(await allowFeedback(env, ip))) return json({ ok: false, error: "rate" }, 429);

  const text = [
    "Neues Feedback von blue-lagune.com",
    "",
    `Name: ${escapeText(name)}`,
    `E-Mail: ${escapeText(email)}`,
    "",
    escapeText(message),
  ].join("\n");

  const fromAddr = "feedback@blue-lagune.com";
  const subject = `Feedback: ${escapeText(name).slice(0, 60)}`;
  const subj = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const raw = [
    `From: Blue Lagune <${fromAddr}>`,
    `To: ${FEEDBACK_TO}`,
    `Reply-To: ${email}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");
  try {
    await env.EMAIL.send(new EmailMessage(fromAddr, FEEDBACK_TO, raw));
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const code = e?.code || e?.message || "mail";
    console.error(JSON.stringify({ feedbackMail: String(code) }));
    return json({ ok: false, error: "mail", code: String(code) }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sitemap.xml") {
      return new Response(SITEMAP_XML.trim() + "\n", {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=0, must-revalidate",
        },
      });
    }

    if (url.pathname === "/api/visitors") {
      // Nur lesend (Anzeige); gezählt wird ausschließlich serverseitig beim Seitenabruf.
      const count = await readCount(env);
      return Response.json(
        { count },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/admin/besuche" && request.method === "GET") {
      const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
      const headers = new Headers(request.headers);
      headers.set("x-bl-admin-env", JSON.stringify({ ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN, ACCESS_AUD: env.ACCESS_AUD }));
      return stub.fetch("https://visitors/admin", { headers });
    }

    if (url.pathname === "/api/reports" && request.method === "GET") {
      const stub = env.VISITORS.get(env.VISITORS.idFromName("global"));
      const res = await stub.fetch("https://visitors/reports");
      const data = await res.json();
      return json(data, res.status);
    }
    if (url.pathname === "/api/reports" && request.method === "POST") {
      return handleReport(request, env);
    }
    if (url.pathname === "/api/reports" && request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedback(request, env);
    }
    if (url.pathname === "/api/feedback" && request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "GET" && isSitePage(url)) {
      const ip = request.headers.get("CF-Connecting-IP");
      ctx.waitUntil(countVisit(env, ip).catch(() => undefined));
    }

    return env.ASSETS.fetch(request);
  },
};
