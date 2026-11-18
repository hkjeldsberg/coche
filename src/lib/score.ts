import { FEATURES, LEVEL_POINTS, TRIM_STANDARD, type Level, type Severity } from "./features";

export type FeatureStatus = "found" | "standard" | "missing";

export type FeatureResult = {
  key: string;
  label: string;
  status: FeatureStatus;
  level: Level;
  missingLabel: string;
  severity: Severity;
};

export type ScoreResult = {
  score: number; // 0-100
  features: FeatureResult[]; // active (level != off) only
  failsMustHave: boolean; // a "må ha" feature is missing (not found and not trim standard)
};

/**
 * Score = points of matched active features / points of all active features × 100.
 * A feature that is not in the ad but is standard on the detected trim counts as matched
 * (shown as "trolig standard" so you can verify).
 */
export function scoreListing(
  found: string[],
  trim: string | null,
  drivetrain: string | null,
  levels: Record<string, Level>,
): ScoreResult {
  const foundSet = new Set(found);
  // Drivetrain from structured data overrides keyword guess.
  if (drivetrain === "AWD") foundSet.add("awd");
  if (drivetrain === "RWD") foundSet.delete("awd");
  const standard = new Set(TRIM_STANDARD[trim ?? ""] ?? []);

  let total = 0;
  let got = 0;
  let failsMustHave = false;
  const features: FeatureResult[] = [];

  for (const f of FEATURES) {
    const level = levels[f.key] ?? f.defaultLevel;
    if (level === "off") continue;
    const points = LEVEL_POINTS[level];
    const status: FeatureStatus = foundSet.has(f.key) ? "found" : standard.has(f.key) ? "standard" : "missing";
    total += points;
    if (status !== "missing") got += points;
    if (level === "must" && status === "missing") failsMustHave = true;
    features.push({ key: f.key, label: f.label, status, level, missingLabel: f.missingLabel, severity: f.severity });
  }

  return { score: total === 0 ? 100 : Math.round((got / total) * 100), features, failsMustHave };
}
