import * as cheerio from "cheerio";
import { FEATURES } from "./features";

/** Subset of a Finn search API doc that we use. */
export type FinnSearchDoc = {
  id: string;
  heading?: string;
  location?: string;
  canonical_url?: string;
  image?: { url?: string };
  timestamp?: number;
  price?: { amount?: number };
  organisation_name?: string;
  year?: number;
  mileage?: number;
  model?: string;
  model_specification?: string;
  driving_range?: number;
  chassis_number?: string;
  regno?: string;
  coordinates?: { lat?: number; lon?: number };
};

export type Detail = {
  specs: Record<string, string>;
  equipment: string[];
  description: string;
};

export type Drivetrain = "AWD" | "RWD" | "Unknown";
export type RangeVariant = "twin" | "extended" | "standard" | "unknown";
export type Trim = "Core" | "Plus" | "Ultimate" | "Ultra" | "Unknown";

export function normalizeRegNr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}\d{4,5}$/.test(s) ? s : null;
}

export function parseInt0(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** Extract specs (dt/dd), equipment list and description from a Finn ad page. */
export function parseDetailHtml(html: string): Detail {
  const $ = cheerio.load(html);
  const section = (title: string) => $("h2").filter((_, el) => $(el).text().trim() === title).first().parent();

  const specs: Record<string, string> = {};
  section("Spesifikasjoner")
    .find("dt")
    .each((_, dt) => {
      // dt may contain tooltip text after the label (e.g. "Rekkevidde (WLTP)WLTP er et måltall...")
      const key = $(dt).clone().children().remove().end().text().trim() || $(dt).text().trim();
      const val = $(dt).next("dd").text().replace(/\s+/g, " ").trim();
      if (key && !(key in specs)) specs[key] = val;
    });

  const equipment = section("Utstyr")
    .find("li")
    .map((_, li) => $(li).text().trim())
    .get()
    .filter(Boolean);

  const descEl = section("Beskrivelse").find("[data-testid=expandable-section]").first();
  descEl.find("br").replaceWith("\n");
  const description = (descEl.length ? descEl : section("Beskrivelse")).text().replace(/ /g, " ").trim();

  return { specs, equipment, description };
}

export function specValue(specs: Record<string, string>, prefix: string): string | undefined {
  const k = Object.keys(specs).find((key) => key.toLowerCase().startsWith(prefix.toLowerCase()));
  return k ? specs[k] : undefined;
}

const NEGATION = /(uten|ikke|mangler|ingen|savner)\s+(?:\S+\s+){0,2}$/i;

/** Feature keys found in equipment list (trusted) or free text (with simple negation check). */
export function detectFeatures(equipment: string[], text: string): string[] {
  const found = new Set<string>();
  for (const f of FEATURES) {
    if (equipment.some((item) => f.patterns.some((p) => p.test(item)))) {
      found.add(f.key);
      continue;
    }
    for (const p of f.patterns) {
      const g = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
      for (const m of text.matchAll(g)) {
        const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
        if (!NEGATION.test(before)) {
          found.add(f.key);
          break;
        }
      }
      if (found.has(f.key)) break;
    }
  }
  // A 360 camera implies a rear camera.
  if (found.has("camera_360")) found.add("rear_camera");
  return [...found];
}

export function detectDrivetrain(hjuldrift: string | undefined, text: string): Drivetrain {
  const h = (hjuldrift ?? "").toLowerCase();
  if (h.includes("firehjul")) return "AWD";
  if (h.includes("bakhjul")) return "RWD";
  if (/(?<![\p{L}\p{N}])(twin|awd|4x4|firehjulsdrift|408 ?hk|442 ?hk|300 ?kw|325 ?kw)(?![\p{L}\p{N}])/iu.test(text)) return "AWD";
  if (/(?<![\p{L}\p{N}])(single motor|extended range|rwd|bakhjulsdrift)(?![\p{L}\p{N}])/iu.test(text)) return "RWD";
  return "Unknown";
}

/**
 * 2024+ variants: Twin Motor (AWD, ~520-540 km), Single Motor Extended Range (RWD, 82 kWh, ~560-570 km),
 * Single Motor (RWD, 69 kWh, ~460-480 km).
 */
export function detectRangeVariant(drivetrain: Drivetrain, wltp: number | null, text: string): RangeVariant {
  if (drivetrain === "AWD") return "twin";
  if (/extended range|ext\.? range|82 ?kwh|79 ?kwh/i.test(text)) return "extended";
  if (wltp != null) return wltp >= 500 ? "extended" : "standard";
  if (/69 ?kwh|67 ?kwh/i.test(text)) return "standard";
  return "unknown";
}

export function detectTrim(text: string): { trim: Trim; blackEdition: boolean } {
  const blackEdition = /black edition/i.test(text);
  const w = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${s}(?![\\p{L}\\p{N}])`, "iu");
  let trim: Trim = "Unknown";
  if (w("ultimate").test(text)) trim = "Ultimate";
  else if (w("ultra").test(text)) trim = "Ultra";
  else if (w("plus").test(text)) trim = "Plus";
  else if (w("core").test(text)) trim = "Core";
  return { trim, blackEdition };
}
