import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { planDownload } from "../src/lib/offline-tiles";

describe("Offline ohne Satellit", () => {
  it("Offline-Download lädt nur OpenFreeMap (Vektor + Schriften)", () => {
    const { urls } = planDownload({ west: 6.9, east: 7.0, south: 50.9, north: 50.95 }, 12);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith("https://tiles.openfreemap.org/"))).toBe(true);
    expect(urls.some((u) => u.includes("/fonts/Noto%20Sans%20Regular/0-255.pbf"))).toBe(true);
  });
});
