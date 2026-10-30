import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

const grep = (pat: string) => {
  try { return execSync(`grep -rlE "${pat}" src worker worker.ts`, { encoding: "utf8" }).trim().split("\n").filter(Boolean); } catch { return []; }
};

describe("Zuletzt gesucht bleibt auf dem Gerät", () => {
  it("bl-recent-q wird nur in der Suche (konzept1.tsx) gelesen/geschrieben", () => {
    expect(grep("bl-recent-q")).toEqual(["src/components/shell/konzept1.tsx"]);
  });
  it("kein Sentry, keine Analyse im Client/Worker; falls Sentry kommt, ist Schwärzung Pflicht", () => {
    expect(grep("@sentry/|Sentry\\.init")).toEqual([]);
    expect(grep("plausible|umami|gtag\\(|google-analytics")).toEqual([]);
  });
  it("Metrik-Code (falls vorhanden) bekommt weder query noch Verlauf", () => {
    for (const f of grep("api/metric")) {
      const src = execSync(`cat ${f}`, { encoding: "utf8" });
      expect(src).not.toMatch(/query|bl-recent-q|RECENT_KEY/);
    }
  });
});
