import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectDrivetrain,
  detectFeatures,
  detectRangeVariant,
  detectTrim,
  normalizeRegNr,
  parseDetailHtml,
  parseInt0,
  specValue,
} from "../src/lib/parse";
import { defaultLevels } from "../src/lib/features";
import { scoreListing } from "../src/lib/score";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf8");

describe("parseDetailHtml (real Finn ad)", () => {
  const d = parseDetailHtml(fixture("finn-ad-481286377.html"));

  it("extracts specs", () => {
    expect(specValue(d.specs, "Hjuldrift")).toBe("Firehjulsdrift");
    expect(parseInt0(specValue(d.specs, "Omregistrering"))).toBe(7505);
    expect(parseInt0(specValue(d.specs, "Rekkevidde"))).toBe(532);
    expect(specValue(d.specs, "Chassis")).toBe("LYVXZERR8RL259221");
  });

  it("extracts equipment and description", () => {
    expect(d.equipment).toContain("Ratt oppvarmet");
    expect(d.equipment).toContain("Cruisekontroll adaptive");
    expect(d.equipment.length).toBeGreaterThan(30);
    expect(d.description).toMatch(/sommer og vinterhjul/i);
  });

  it("detects features from equipment + text", () => {
    const f = detectFeatures(d.equipment, d.description);
    expect(f).toEqual(
      expect.arrayContaining(["heated_wheel", "rear_camera", "tow_hitch", "winter_wheels", "acc", "practical_boot"]),
    );
    expect(f).not.toContain("harman_kardon");
  });
});

describe("detectFeatures", () => {
  it("respects negation in free text", () => {
    expect(detectFeatures([], "Bilen har ikke hengerfeste")).not.toContain("tow_hitch");
    expect(detectFeatures([], "Leveres uten vinterhjul")).not.toContain("winter_wheels");
    expect(detectFeatures([], "Leveres med vinterhjul")).toContain("winter_wheels");
  });

  it("does not treat '360 km' or 'TACCO' as features", () => {
    expect(detectFeatures([], "Rekkevidde 360 km")).not.toContain("camera_360");
    expect(detectFeatures([], "TACCOS")).not.toContain("acc");
  });

  it("matches seller shorthand", () => {
    const f = detectFeatures([], "TWIN AWD PLUS/KROK/KLIMA/NAVI/ACC/KAMERA/408HK!");
    expect(f).toEqual(expect.arrayContaining(["awd", "tow_hitch", "acc", "rear_camera"]));
    expect(detectFeatures([], "Ultra AWD- H&K, 360°, Memory")).toEqual(
      expect.arrayContaining(["harman_kardon", "camera_360", "rear_camera"]),
    );
    expect(detectFeatures([], "Plus / KROK / ACC / V.PUMPE / APP")).toContain("heat_pump");
  });
});

describe("drivetrain / range / trim", () => {
  it("uses structured hjuldrift first", () => {
    expect(detectDrivetrain("Bakhjulsdrift", "Twin")).toBe("RWD");
    expect(detectDrivetrain(undefined, "Recharge Twin 408hk AWD Plus")).toBe("AWD");
    expect(detectDrivetrain(undefined, "Extended Range Ultimate")).toBe("RWD");
  });

  it("classifies range variant", () => {
    expect(detectRangeVariant("AWD", 532, "")).toBe("twin");
    expect(detectRangeVariant("RWD", 561, "")).toBe("extended");
    expect(detectRangeVariant("RWD", 476, "")).toBe("standard");
    expect(detectRangeVariant("RWD", null, "Extended Range")).toBe("extended");
    expect(detectRangeVariant("Unknown", null, "")).toBe("unknown");
  });

  it("detects trims", () => {
    expect(detectTrim("Twin Motor Ultra Black Edition")).toEqual({ trim: "Ultra", blackEdition: true });
    expect(detectTrim("Extended Range Ultimate Harman")).toEqual({ trim: "Ultimate", blackEdition: false });
    expect(detectTrim("RECHARGE TWIN PLUS EDITION AWD")).toEqual({ trim: "Plus", blackEdition: false });
    expect(detectTrim("Twin Performance")).toEqual({ trim: "Unknown", blackEdition: false });
  });

  it("normalizes plates", () => {
    expect(normalizeRegNr("eb 12345")).toBe("EB12345");
    expect(normalizeRegNr("garbage")).toBeNull();
  });
});

describe("scoreListing", () => {
  it("gives 100 when every active feature is found", () => {
    const all = ["heated_wheel", "rear_camera", "heat_pump", "awd", "tow_hitch", "winter_wheels", "acc", "camera_360", "harman_kardon", "practical_boot"];
    expect(scoreListing(all, null, "AWD", defaultLevels()).score).toBe(100);
  });

  it("counts trim-standard equipment and flags must-haves", () => {
    const levels = { ...defaultLevels(), tow_hitch: "must" as const };
    const r = scoreListing([], "Plus", "RWD", levels);
    expect(r.features.find((f) => f.key === "heat_pump")?.status).toBe("standard");
    expect(r.features.find((f) => f.key === "tow_hitch")?.status).toBe("missing");
    expect(r.failsMustHave).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
  });

  it("ignores features set to off", () => {
    const levels = Object.fromEntries(Object.keys(defaultLevels()).map((k) => [k, "off" as const]));
    expect(scoreListing([], null, null, levels)).toMatchObject({ score: 100, features: [] });
  });
});
