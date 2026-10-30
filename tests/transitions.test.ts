import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../src/theme/tokens";
import { VARIANTS } from "../src/theme/variants";

const ms = (v: string) => (v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000);
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(css|tsx?)$/.test(f) ? [p] : [];
  });
}

describe("UI-Übergänge < 250 ms (außer Fly und Sheet)", () => {
  it("Tokens: fast/ui < 250 ms, fly ≤ 600 ms", () => {
    for (const v of [DEFAULT_THEME, ...Object.values(VARIANTS)])
      for (const t of [v.light, v.dark]) {
        expect(ms(t["dur-fast"])).toBeLessThan(250);
        expect(ms(t["dur-ui"])).toBeLessThan(250);
        expect(ms(t["dur-fly"])).toBeLessThanOrEqual(600);
      }
  });
  it("keine transition/duration > 250 ms im Code", () => {
    const bad: string[] = [];
    for (const f of files("src")) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/fly|sheet/i.test(line)) return;
        for (const m of line.matchAll(/transition[^;"]*?(\d+(?:\.\d+)?m?s)\b/g)) if (ms(m[1]) > 250) bad.push(`${f}:${i + 1} ${m[0]}`);
        for (const m of line.matchAll(/\bduration-(\d+)\b/g)) if (+m[1] > 250) bad.push(`${f}:${i + 1} ${m[0]}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
