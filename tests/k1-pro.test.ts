import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { de, en } from "../src/lib/i18n";

const read = (f: string) => readFileSync(f, "utf8");
const lex = read("/workspace/legal/bluelagune-esri-einwilligung-20261030.md");

describe("K1 Pro (miniHard, minihard/k1-pro)", () => {
  it("Pro-Tab nutzt den Pro-Europa-Inhalt, Chip hängt pro_chip_seen an", () => {
    const k1 = read("src/components/shell/konzept1.tsx");
    expect(k1).toMatch(/<K1ProContent/);
    expect(k1).toMatch(/useK1ProChipSeen\(/);
    expect(k1).not.toMatch(/proNote/);
    const p = read("src/components/pro-k1.tsx");
    expect(p).toMatch(/chipSeenOnce/);
    expect(p).toMatch(/mapGesture/);
    expect(p).toMatch(/proActive\(\)/);
  });
  it("/pro-Seite und /api/metric + /admin/pro geroutet, PRO_TEST-Schalter", () => {
    expect(read("src/App.tsx")).toMatch(/path === "\/pro" && proActive\(\)/);
    const w = read("worker.ts");
    expect(w).toMatch(/"\/api\/metric"/);
    expect(w).toMatch(/"\/admin\/pro"/);
    expect(w).toMatch(/PRO_TEST\?: string/);
  });
  it("visitors.ts: MACROHards Version (Mitternachts-Alarm) unverändert", () => {
    expect(execSync("git diff --stat 831222f -- worker/visitors.ts", { encoding: "utf8" }).trim()).toBe("");
    expect(read("worker.ts")).toMatch(/async alarm\(\)/);
  });
  it("Datenschutz: privacySatP wörtlich Lex, Kapitel mit Status und Widerruf", () => {
    expect(lex).toContain(de.privacySatP);
    expect(lex).toContain(en.privacySatP);
    const l = read("src/components/legal-pages.tsx");
    expect(l).toMatch(/id="satellitenvorschau"/);
    expect(l).toMatch(/revokeSat\(\)/);
    expect(l).toMatch(/SAT_LATER_KEY/);
    expect(l).not.toMatch(/bl-sat-preview-ok/);
    expect(l.match(/t\("privacySatP"\)/g)?.length).toBe(1);
  });
  it("Zuletzt gesucht: Lex-Wortlaut in privacyLsP, privacyVisitP unangetastet", () => {
    expect(de.privacyLsP).toContain("sowie deine zuletzt eingegebenen Suchbegriffe („Zuletzt gesucht“). Sie bleiben nur auf deinem Gerät und werden nicht an uns übertragen. Du kannst sie jederzeit in der Suche löschen oder über die Browser-Einstellungen entfernen.");
    expect(en.privacyLsP).toContain('and your recent search terms ("Recent searches"). They stay on your device only and are not sent to us. You can delete them at any time in the search or via your browser settings.');
    expect(de.privacyLsP.startsWith("Filter, Merkliste")).toBe(true);
    expect(execSync("git diff 831222f -- src/lib/i18n.ts | grep '^-' | grep -v '^---' | grep -c privacyVisitP || true", { encoding: "utf8" }).trim()).toBe("0");
  });
  it("Pro-Datenschutzabsatz privacyProP wie b3cbeaa (DE/EN)", () => {
    expect(de.privacyProP).toContain("27.11.2026");
    expect(en.privacyProP).toContain("Pro Europa");
    expect(read("src/components/legal-pages.tsx")).toMatch(/t\("privacyProP"\)/);
  });
  it("bl-recent-q geht nicht an Metrik oder Sentry", () => {
    expect(read("src/lib/pro-metric.ts")).not.toMatch(/recent|query/);
    expect(execSync("grep -rln 'bl-recent-q\\|RECENT_KEY' src worker worker.ts || true", { encoding: "utf8" }).trim()).toBe("src/components/shell/konzept1.tsx");
    expect(execSync("grep -rli 'sentry' src worker worker.ts || true", { encoding: "utf8" }).trim()).toBe("");
  });
});

describe("Datenschutz Satellitenvorschau: Farben nur var(--bl-*)", () => {
  it("Widerruf-Knopf und Statuszeile ohne Tailwind-Farbklassen, Tokens auf Rechtsseiten verfügbar", () => {
    const l = read("src/components/legal-pages.tsx");
    const sec = l.slice(l.indexOf("function SatPreviewPrivacy"), l.indexOf("export function DatenschutzPage"));
    expect(sec).not.toMatch(/bg-primary|text-primary-fg|text-fg|bg-surface|ring-border/);
    expect(sec).toMatch(/bl-legal-tokens/);
    const css = read("src/theme/legal-sat.css");
    expect(css).toMatch(/\.bl-sat-revoke[^}]*var\(--bl-accent\)/);
    expect(css).toMatch(/min-height: 44px/);
    expect(css.replace(/var\(--bl-[a-z-]+\)/g, "")).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
    expect(execSync("git diff --stat 831222f -- src/theme/shell.css", { encoding: "utf8" }).trim()).toBe("");
  });
});
