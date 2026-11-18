import "server-only";
import { createClient } from "@supabase/supabase-js";

export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, {
    db: { schema: "coche" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ListingRow = {
  id: string;
  external_id: string;
  reg_nr: string | null;
  url: string;
  title: string;
  model_spec: string | null;
  model_variant: string | null;
  drivetrain: string | null;
  range_variant: string | null;
  trim_level: string | null;
  is_black_edition: boolean;
  model_year: number;
  mileage_km: number;
  wltp_range_km: number | null;
  price_nok: number;
  first_price_nok: number;
  omreg_fee_nok: number | null;
  dealer_name: string | null;
  location: string | null;
  lat: number | null;
  lon: number | null;
  fylke: string | null;
  kommune: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  found_features: string[];
  detail_fetched_at: string | null;
  is_hidden: boolean;
  is_favorite: boolean;
  first_seen_at: string;
  is_active: boolean;
};

export type PrefsRow = {
  max_price_nok: number;
  max_mileage_km: number;
  min_wltp_km: number;
  drivetrain: "all" | "awd" | "rwd";
  sort: "score" | "price" | "newest" | "drop" | "distance";
  feature_levels: Record<string, string>;
  max_distance_km: number;
  fylker: string[];
};
