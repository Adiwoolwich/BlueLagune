import { describe, expect, it } from "vitest";
import { designFromUrl, konzeptFromUrl } from "../src/theme/tokens";

describe("K1 als Standard", () => {
  it("ohne Parameter: teal + konzept 1", () => {
    expect(designFromUrl("")).toBe("teal");
    expect(konzeptFromUrl("")).toBe("1");
    expect(designFromUrl("?lat=51&lng=7&z=13")).toBe("teal");
    expect(konzeptFromUrl("?lat=51&lng=7&z=13")).toBe("1");
  });
  it("?alt=1: alte Oberfläche", () => {
    expect(designFromUrl("?alt=1")).toBeNull();
    expect(konzeptFromUrl("?alt=1")).toBeNull();
  });
  it("vorhandene Parameter unverändert", () => {
    expect(designFromUrl("?design=sand")).toBe("sand");
    expect(konzeptFromUrl("?design=sand")).toBeNull();
    expect(designFromUrl("?design=teal&konzept=1")).toBe("teal");
    expect(konzeptFromUrl("?design=nacht&konzept=a")).toBe("a");
    expect(designFromUrl("?design=xyz")).toBeNull();
  });
});
