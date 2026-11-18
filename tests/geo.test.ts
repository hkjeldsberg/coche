import { describe, expect, it } from "vitest";
import { distanceFromOslo } from "../src/lib/geo";

describe("distanceFromOslo", () => {
  it("computes straight-line km", () => {
    expect(distanceFromOslo(59.9139, 10.7522)).toBe(0);
    // Arendal ≈ 195 km, Bergen ≈ 305 km, Bodø ≈ 800 km (great-circle)
    expect(distanceFromOslo(58.4566, 8.7209)).toBeGreaterThan(185);
    expect(distanceFromOslo(58.4566, 8.7209)).toBeLessThan(210);
    expect(distanceFromOslo(60.3913, 5.3221)).toBeGreaterThan(295);
    expect(distanceFromOslo(60.3913, 5.3221)).toBeLessThan(315);
    expect(distanceFromOslo(67.2804, 14.4049)).toBeGreaterThan(780);
  });
  it("returns null without coordinates", () => {
    expect(distanceFromOslo(null, 10)).toBeNull();
  });
});
