export type Level = "must" | "important" | "bonus" | "off";
export type Severity = "red" | "amber" | "subtle";

export const LEVEL_POINTS: Record<Level, number> = {
  must: 15,
  important: 15,
  bonus: 5,
  off: 0,
};

export const LEVEL_LABEL: Record<Level, string> = {
  must: "Må ha",
  important: "Viktig",
  bonus: "Bonus",
  off: "Av",
};

export type FeatureDef = {
  key: string;
  label: string;
  defaultLevel: Level;
  /** Matched against Finn equipment list items and free text (lowercased). */
  patterns: RegExp[];
  missingLabel: string;
  severity: Severity;
};

// Word-boundary helper that treats Norwegian letters as word chars.
const W = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const re = (src: string) => new RegExp(`${W}(?:${src})${E}`, "iu");

export const FEATURES: FeatureDef[] = [
  {
    key: "heated_wheel",
    label: "Varme i rattet",
    defaultLevel: "important",
    patterns: [re("oppvarmet ratt|ratt,? oppvarmet|varme i rattet?|rattvarme|oppv\\.? ratt|heated steering wheel")],
    missingLabel: "Mangler rattvarme",
    severity: "red",
  },
  {
    key: "rear_camera",
    label: "Ryggekamera",
    defaultLevel: "important",
    patterns: [re("ryggekamera|rygge-kamera|parkeringskamera|rygge ?kam|kamera|360 ?°?-?kamera|360°|360-view")],
    missingLabel: "Mangler ryggekamera",
    severity: "red",
  },
  {
    key: "heat_pump",
    label: "Varmepumpe",
    defaultLevel: "important",
    patterns: [re("varmepumpe|v\\.? ?pumpe|heat ?pump")],
    missingLabel: "Mangler varmepumpe",
    severity: "red",
  },
  {
    key: "awd",
    label: "Twin Motor (AWD)",
    defaultLevel: "important",
    patterns: [re("twin|awd|4x4|4wd|firehjulsdrift|300 ?kw|325 ?kw|408 ?hk|442 ?hk")],
    missingLabel: "RWD — ikke AWD",
    severity: "amber",
  },
  {
    key: "tow_hitch",
    label: "Hengerfeste",
    defaultLevel: "important",
    patterns: [re("hengerfeste|tilhengerfeste|h\\.? ?feste|hfest|krok|semi-?elektrisk hengerfeste|towbar")],
    missingLabel: "Mangler hengerfeste (~18k kr)",
    severity: "amber",
  },
  {
    key: "winter_wheels",
    label: "Vinterhjul inkludert",
    defaultLevel: "important",
    patterns: [re("vinterhjul|vinterdekk|piggfri|piggfrie|piggdekk|2 sett hjul|to sett hjul|sommer- ?og vinter|sommer ?\\+ ?vinter|sommer og vinterhjul")],
    missingLabel: "Vinterhjul ikke nevnt (~15k kr)",
    severity: "amber",
  },
  {
    key: "acc",
    label: "Adaptiv cruise / Pilot Assist",
    defaultLevel: "bonus",
    patterns: [re("adaptiv(?:e)? cruise|cruisekontroll,? adaptiv(?:e)?|acc|pilot ?assist|adaptivecruise")],
    missingLabel: "Mangler ACC",
    severity: "amber",
  },
  {
    key: "camera_360",
    label: "360° kamera",
    defaultLevel: "bonus",
    patterns: [re("360 ?°? ?-?kamera|360 ?°|360 ?\\*|360-view|360 view|kamera 360|360(?= ?[|/,+]| ?$)")],
    missingLabel: "Kun vanlig ryggekamera",
    severity: "subtle",
  },
  {
    key: "harman_kardon",
    label: "Harman Kardon",
    defaultLevel: "bonus",
    patterns: [re("harman ?/? ?kardon|harmankardon|harman|h ?& ?k|h/k")],
    missingLabel: "Standard lydanlegg",
    severity: "subtle",
  },
  {
    key: "practical_boot",
    label: "Praktisk bagasjerom",
    defaultLevel: "bonus",
    patterns: [re("skiluke|elektrisk bakluke|bakluke,? elektrisk|el\\.? ?bakluke|bagasjeromsmatte")],
    missingLabel: "Ingen el. bakluke / skiluke nevnt",
    severity: "subtle",
  },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]));

export function defaultLevels(): Record<string, Level> {
  return Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultLevel]));
}

export function resolveLevels(stored: Record<string, unknown> | null | undefined): Record<string, Level> {
  const out = defaultLevels();
  for (const [k, v] of Object.entries(stored ?? {})) {
    if (k in out && typeof v === "string" && v in LEVEL_POINTS) out[k] = v as Level;
  }
  return out;
}

/**
 * Equipment that is (to our best knowledge) standard on a 2024+ trim.
 * Used to say "trolig standard" instead of "mangler" when the ad just omits it.
 * ASSUMPTION — verify against Volvo NO price lists and edit as needed.
 */
export const TRIM_STANDARD: Record<string, string[]> = {
  Core: ["heat_pump", "acc", "rear_camera"],
  Plus: ["heat_pump", "acc", "rear_camera", "heated_wheel", "practical_boot"],
  Ultimate: ["heat_pump", "acc", "rear_camera", "heated_wheel", "practical_boot", "camera_360", "harman_kardon"],
  Ultra: ["heat_pump", "acc", "rear_camera", "heated_wheel", "practical_boot", "camera_360", "harman_kardon"],
};
