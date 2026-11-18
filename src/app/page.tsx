import { Suspense } from "react";
import { connection } from "next/server";
import { db, type ListingRow, type PrefsRow } from "@/lib/db";
import { resolveLevels } from "@/lib/features";
import Dashboard from "@/components/Dashboard";

const LISTING_COLUMNS =
  "id, external_id, reg_nr, url, title, model_spec, model_variant, drivetrain, range_variant, trim_level, is_black_edition, model_year, mileage_km, wltp_range_km, price_nok, first_price_nok, omreg_fee_nok, dealer_name, location, thumbnail_url, published_at, found_features, detail_fetched_at, is_hidden, is_favorite, first_seen_at, is_active";

async function Data() {
  await connection();
  const supa = db();
  const [listings, prefs] = await Promise.all([
    supa.from("listings").select(LISTING_COLUMNS).eq("is_active", true),
    supa.from("user_preferences").select("max_price_nok, max_mileage_km, min_wltp_km, drivetrain, sort, feature_levels").eq("id", 1).maybeSingle(),
  ]);
  if (listings.error) throw new Error(listings.error.message);
  if (prefs.error) throw new Error(prefs.error.message);

  const p = (prefs.data ?? {}) as Partial<PrefsRow>;
  const initialPrefs: PrefsRow = {
    max_price_nok: p.max_price_nok ?? 600_000,
    max_mileage_km: p.max_mileage_km ?? 50_000,
    min_wltp_km: p.min_wltp_km ?? 500,
    drivetrain: p.drivetrain ?? "all",
    sort: p.sort ?? "score",
    feature_levels: resolveLevels(p.feature_levels),
  };
  return <Dashboard listings={listings.data as ListingRow[]} initialPrefs={initialPrefs} />;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Laster biler…</p>}>
      <Data />
    </Suspense>
  );
}
