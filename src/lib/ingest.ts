import "server-only";
import { db } from "./db";
import { adUrl, fetchAdHtml, fetchAllSearchDocs } from "./finn";
import {
  detectDrivetrain,
  detectFeatures,
  detectRangeVariant,
  detectTrim,
  normalizeRegNr,
  parseDetailHtml,
  parseInt0,
  specValue,
  type FinnSearchDoc,
} from "./parse";

export type IngestResult = {
  searchTotal: number;
  inserted: number;
  priceChanges: number;
  deactivated: number;
  detailsFetched: number;
  detailErrors: number;
  detailsRemaining: number;
};

type Existing = {
  id: string;
  external_id: string;
  price_nok: number;
  first_price_nok: number;
  detail_fetched_at: string | null;
};

/** Fields inferred from text; only written from search data until the detail page has been parsed. */
function derivedFromText(text: string, wltp: number | null, hjuldrift?: string, headline = text) {
  const drivetrain = detectDrivetrain(hjuldrift, text);
  // Prefer the seller's headline for trim; descriptions often mention other trims in passing.
  const head = detectTrim(headline);
  const { trim, blackEdition } = head.trim !== "Unknown" ? head : detectTrim(text);
  return {
    drivetrain,
    range_variant: detectRangeVariant(drivetrain, wltp, text),
    trim_level: trim,
    is_black_edition: blackEdition,
  };
}

function baseRow(d: FinnSearchDoc) {
  const id = String(d.id);
  return {
    source: "finn",
    external_id: id,
    reg_nr: normalizeRegNr(d.regno),
    vin: d.chassis_number ?? null,
    url: d.canonical_url ?? adUrl(id),
    title: d.heading ?? "Volvo",
    model_spec: d.model_specification ?? null,
    model_variant: d.model ?? null,
    model_year: d.year ?? 0,
    mileage_km: d.mileage ?? 0,
    wltp_range_km: d.driving_range ?? null,
    price_nok: d.price?.amount ?? 0,
    dealer_name: d.organisation_name ?? null,
    location: d.location ?? null,
    thumbnail_url: d.image?.url ?? null,
    published_at: d.timestamp ? new Date(d.timestamp).toISOString() : null,
    last_seen_at: new Date().toISOString(),
    is_active: true,
  };
}

async function searchPhase() {
  const supa = db();
  const docs = (await fetchAllSearchDocs()).filter((d) => d.price?.amount && d.year);

  const { data: existingRows, error } = await supa
    .from("listings")
    .select("id, external_id, price_nok, first_price_nok, detail_fetched_at")
    .eq("source", "finn");
  if (error) throw error;
  const existing = new Map((existingRows as Existing[]).map((r) => [r.external_id, r]));

  const rows = docs.map((d) => {
    const base = baseRow(d);
    const prev = existing.get(base.external_id);
    const text = `${base.title} ${base.model_variant ?? ""} ${base.model_spec ?? ""}`;
    return {
      ...base,
      first_price_nok: prev?.first_price_nok ?? base.price_nok,
      ...(prev?.detail_fetched_at
        ? {}
        : { ...derivedFromText(text, base.wltp_range_km), found_features: detectFeatures([], text) }),
    };
  });

  // Rows with/without derived fields have different column sets; upsert separately so PostgREST
  // doesn't null out columns missing from a subset.
  const withDerived = rows.filter((r) => "drivetrain" in r);
  const withoutDerived = rows.filter((r) => !("drivetrain" in r));
  const upserted: { id: string; external_id: string; price_nok: number }[] = [];
  for (const batch of [withDerived, withoutDerived]) {
    if (!batch.length) continue;
    const { data, error: upErr } = await supa
      .from("listings")
      .upsert(batch, { onConflict: "source,external_id" })
      .select("id, external_id, price_nok");
    if (upErr) throw upErr;
    upserted.push(...data);
  }

  let inserted = 0;
  let priceChanges = 0;
  const history = [];
  for (const r of upserted) {
    const prev = existing.get(r.external_id);
    if (!prev) inserted++;
    else if (prev.price_nok !== r.price_nok) priceChanges++;
    else continue;
    history.push({ listing_id: r.id, price_nok: r.price_nok });
  }
  if (history.length) {
    const { error: hErr } = await supa.from("price_history").insert(history);
    if (hErr) throw hErr;
  }

  // Search completed every page, so anything not seen is gone from Finn.
  const seen = new Set(rows.map((r) => r.external_id));
  const gone = [...existing.keys()].filter((id) => !seen.has(id));
  let deactivated = 0;
  if (gone.length) {
    const { data, error: dErr } = await supa
      .from("listings")
      .update({ is_active: false })
      .eq("source", "finn")
      .eq("is_active", true)
      .in("external_id", gone)
      .select("id");
    if (dErr) throw dErr;
    deactivated = data.length;
  }

  return { searchTotal: rows.length, inserted, priceChanges, deactivated };
}

async function fetchDetail(row: { id: string; external_id: string; title: string; model_spec: string | null; model_variant: string | null; wltp_range_km: number | null; reg_nr: string | null }) {
  const html = await fetchAdHtml(row.external_id);
  const { specs, equipment, description } = parseDetailHtml(html);
  const wltp = row.wltp_range_km ?? parseInt0(specValue(specs, "Rekkevidde"));
  const headline = `${row.title} ${row.model_variant ?? ""} ${row.model_spec ?? ""}`;
  const text = `${headline}\n${description}`;
  const update = {
    ...derivedFromText(text, wltp, specValue(specs, "Hjuldrift"), headline),
    wltp_range_km: wltp,
    omreg_fee_nok: parseInt0(specValue(specs, "Omregistrering")),
    reg_nr: row.reg_nr ?? normalizeRegNr(specValue(specs, "Registreringsnummer")),
    raw_equipment: equipment,
    description_text: description,
    found_features: detectFeatures(equipment, text),
    detail_fetched_at: new Date().toISOString(),
  };
  const { error } = await db().from("listings").update(update).eq("id", row.id);
  if (error) throw error;
}

async function detailPhase(deadline: number, concurrency = 5) {
  const supa = db();
  const { data, error } = await supa
    .from("listings")
    .select("id, external_id, title, model_spec, model_variant, wltp_range_km, reg_nr")
    .eq("is_active", true)
    .is("detail_fetched_at", null)
    .order("first_seen_at", { ascending: false });
  if (error) throw error;

  const queue = [...data];
  let fetched = 0;
  let errors = 0;
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const row = queue.shift()!;
      try {
        await fetchDetail(row);
        fetched++;
      } catch (e) {
        errors++;
        console.error(`detail ${row.external_id} failed:`, e);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { detailsFetched: fetched, detailErrors: errors, detailsRemaining: queue.length };
}

/**
 * Manual ingestion. Search phase always runs fully; detail fetching stops at the time budget
 * and reports `detailsRemaining` so the caller can trigger again.
 */
export async function runIngest({ budgetMs = 240_000, skipSearch = false } = {}): Promise<IngestResult> {
  const start = Date.now();
  const search = skipSearch
    ? { searchTotal: 0, inserted: 0, priceChanges: 0, deactivated: 0 }
    : await searchPhase();
  const detail = await detailPhase(start + budgetMs);
  return { ...search, ...detail };
}
