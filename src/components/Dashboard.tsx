"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { ListingRow, PrefsRow } from "@/lib/db";
import { FEATURES, LEVEL_LABEL, type Level } from "@/lib/features";
import { scoreListing } from "@/lib/score";
import { DISTANCE_NO_LIMIT, distanceFromOslo } from "@/lib/geo";
import { logout, savePrefs } from "@/app/actions";
import ListingCard from "./ListingCard";

const nok = (n: number) => `${n.toLocaleString("nb-NO")} kr`;
const km = (n: number) => `${n.toLocaleString("nb-NO")} km`;
const LEVELS: Level[] = ["must", "important", "bonus", "off"];

type View = "all" | "favorites" | "hidden";

export default function Dashboard({ listings, initialPrefs }: { listings: ListingRow[]; initialPrefs: PrefsRow }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [view, setView] = useState<View>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Persist prefs (debounced) whenever they change after mount.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void savePrefs(prefs).catch((e) => console.error("savePrefs", e)), 600);
    return () => clearTimeout(t);
  }, [prefs]);

  const levels = prefs.feature_levels as Record<string, Level>;
  const set = <K extends keyof PrefsRow>(k: K, v: PrefsRow[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  const scored = useMemo(
    () =>
      listings.map((l) => ({
        listing: l,
        result: scoreListing(l.found_features ?? [], l.trim_level, l.drivetrain, levels),
        distance: distanceFromOslo(l.lat, l.lon),
      })),
    [listings, levels],
  );

  const visible = useMemo(() => {
    const fylkeSet = new Set(prefs.fylker);
    const out = scored.filter(({ listing: l, result, distance }) => {
      if (view === "hidden") return l.is_hidden;
      if (l.is_hidden) return false;
      if (view === "favorites" && !l.is_favorite) return false;
      if (l.price_nok > prefs.max_price_nok) return false;
      if (l.mileage_km > prefs.max_mileage_km) return false;
      if (l.wltp_range_km != null && l.wltp_range_km < prefs.min_wltp_km) return false;
      if (l.wltp_range_km == null && l.range_variant === "standard") return false;
      if (prefs.drivetrain === "awd" && l.drivetrain !== "AWD") return false;
      if (prefs.drivetrain === "rwd" && l.drivetrain !== "RWD") return false;
      if (prefs.max_distance_km < DISTANCE_NO_LIMIT && distance != null && distance > prefs.max_distance_km) return false;
      if (fylkeSet.size && !fylkeSet.has(l.fylke ?? "")) return false;
      if (result.failsMustHave) return false;
      return true;
    });
    const drop = (l: ListingRow) => l.first_price_nok - l.price_nok;
    const ts = (l: ListingRow) => Date.parse(l.published_at ?? l.first_seen_at);
    const cmp: Record<PrefsRow["sort"], (a: (typeof out)[0], b: (typeof out)[0]) => number> = {
      score: (a, b) => b.result.score - a.result.score || a.listing.price_nok - b.listing.price_nok,
      price: (a, b) => a.listing.price_nok - b.listing.price_nok,
      newest: (a, b) => ts(b.listing) - ts(a.listing),
      drop: (a, b) => drop(b.listing) - drop(a.listing) || b.result.score - a.result.score,
      distance: (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.result.score - a.result.score,
    };
    return out.sort(cmp[prefs.sort]);
  }, [scored, prefs, view]);

  // Fylker present in the data, most listings first.
  const fylkeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of listings) if (l.fylke) m.set(l.fylke, (m.get(l.fylke) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [listings]);
  const toggleFylke = (f: string) =>
    set("fylker", prefs.fylker.includes(f) ? prefs.fylker.filter((x) => x !== f) : [...prefs.fylker, f]);
  const distanceLabel = prefs.max_distance_km >= DISTANCE_NO_LIMIT ? "Alle" : km(prefs.max_distance_km);

  const hiddenCount = listings.filter((l) => l.is_hidden).length;
  const favCount = listings.filter((l) => l.is_favorite && !l.is_hidden).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:pt-6">
      {/* Header */}
      <header className="card mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Coche</h1>
          <p className="text-sm text-muted">Volvo XC40 / EX40 · 2024+ · Finn.no</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form action={logout}>
            <button className="btn px-3 font-medium text-muted hover:text-ink">Logg ut</button>
          </form>
          <ScrapeButton />
        </div>
      </header>

      {/* Filter bar */}
      <section className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 mb-4 border-b border-line bg-ground/90 px-4 py-2 backdrop-blur-md sm:py-4">
        {/* Mobile: compact summary; full controls behind a toggle so cards get the screen */}
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left sm:hidden"
        >
          <span className="num truncate text-xs text-muted">
            ≤{Math.round(prefs.max_price_nok / 1000)}k kr · ≤{Math.round(prefs.max_mileage_km / 1000)}k km · ≥{prefs.min_wltp_km} km
            {prefs.drivetrain !== "all" ? ` · ${prefs.drivetrain.toUpperCase()}` : ""}
            {prefs.max_distance_km < DISTANCE_NO_LIMIT ? ` · ≤${prefs.max_distance_km} km Oslo` : ""}
            {prefs.fylker.length ? ` · ${prefs.fylker.length} fylke${prefs.fylker.length > 1 ? "r" : ""}` : ""}
          </span>
          <span className="btn btn-ghost shrink-0 px-4">Filter {filtersOpen ? "▴" : "▾"}</span>
        </button>
        <div
          className={`${filtersOpen ? "grid" : "hidden"} gap-x-8 gap-y-3 pb-3 pt-2 sm:grid sm:grid-cols-2 sm:p-0 lg:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] xl:items-end`}
        >
          <Slider label="Maks pris" value={prefs.max_price_nok} display={nok(prefs.max_price_nok)} min={350_000} max={700_000} step={10_000} onChange={(v) => set("max_price_nok", v)} />
          <Slider label="Maks km" value={prefs.max_mileage_km} display={km(prefs.max_mileage_km)} min={0} max={120_000} step={5_000} onChange={(v) => set("max_mileage_km", v)} />
          <Slider label="Min WLTP" value={prefs.min_wltp_km} display={km(prefs.min_wltp_km)} min={400} max={600} step={10} onChange={(v) => set("min_wltp_km", v)} />
          <Slider label="Avstand fra Oslo" value={prefs.max_distance_km} display={distanceLabel} min={25} max={DISTANCE_NO_LIMIT} step={25} onChange={(v) => set("max_distance_km", v)} />
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-4 lg:max-w-xl xl:contents">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-muted">Drivlinje</span>
              <select value={prefs.drivetrain} onChange={(e) => set("drivetrain", e.target.value as PrefsRow["drivetrain"])} className="select w-full">
                <option value="all">Alle</option>
                <option value="awd">Kun Twin Motor AWD</option>
                <option value="rwd">Kun Extended Range RWD</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-muted">Sortering</span>
              <select value={prefs.sort} onChange={(e) => set("sort", e.target.value as PrefsRow["sort"])} className="select w-full">
                <option value="score">Høyest score</option>
                <option value="price">Lavest pris</option>
                <option value="newest">Nyeste annonse</option>
                <option value="drop">Størst prisfall</option>
                <option value="distance">Nærmest Oslo</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Side panel: fylker + feature weights */}
        <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto">
          <button onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} className="btn btn-ghost mb-3 w-full justify-between lg:hidden">
            <span>Fylker og utstyr</span>
            <span>{drawerOpen ? "▴" : "▾"}</span>
          </button>
          <div className={`${drawerOpen ? "block" : "hidden"} card space-y-5 p-4 lg:block`}>
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow">Fylker</h2>
                {prefs.fylker.length > 0 && (
                  <button onClick={() => set("fylker", [])} className="text-xs font-semibold text-accent">
                    Nullstill
                  </button>
                )}
              </div>
              {fylkeCounts.length === 0 ? (
                <p className="text-xs text-muted">Fylke hentes ved neste «Hent fra Finn».</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {fylkeCounts.map(([f, n]) => {
                    const on = prefs.fylker.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFylke(f)}
                        aria-pressed={on}
                        className={`chip min-h-8 transition ${on ? "bg-accent text-ground" : "chip-subtle hover:text-ink"}`}
                      >
                        {f} <span className="num opacity-70">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted">{prefs.fylker.length ? "Viser kun valgte fylker." : "Ingen valgt = alle fylker."}</p>
            </div>

            <div className="space-y-4 border-t border-line pt-4">
              <h2 className="eyebrow">Utstyr og vekting</h2>
              {FEATURES.map((f) => (
                <div key={f.key}>
                  <div className="mb-2 text-sm font-semibold">{f.label}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {LEVELS.map((lv) => {
                      const on = levels[f.key] === lv;
                      return (
                        <button
                          key={lv}
                          onClick={() => set("feature_levels", { ...levels, [f.key]: lv })}
                          aria-pressed={on}
                          className={`min-h-9 rounded-full text-xs font-semibold transition ${
                            on
                              ? lv === "must"
                                ? "bg-must text-ground"
                                : lv === "off"
                                  ? "bg-muted text-ground"
                                  : "bg-accent text-ground"
                              : "border border-line-strong text-muted hover:text-ink"
                          }`}
                        >
                          {LEVEL_LABEL[lv]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted">
                Må ha = skjuler biler som mangler det. Viktig = <span className="num">15</span> p, Bonus = <span className="num">5</span> p.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "Alle", visible.length],
                ["favorites", "Favoritter", view === "favorites" ? visible.length : favCount],
                ["hidden", "Skjulte", view === "hidden" ? visible.length : hiddenCount],
              ] as [View, string, number][]
            ).map(([v, label, count]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`btn min-h-9 px-4 font-semibold ${view === v ? "bg-ink text-ground" : "btn-ghost text-muted"}`}
              >
                {label} <span className="num">({count})</span>
              </button>
            ))}
            <span className="num ml-auto text-xs text-muted">{listings.length} aktive</span>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-[20px] border border-dashed border-line-strong p-10 text-center text-muted">
              {listings.length === 0 ? "Ingen annonser ennå — trykk «Hent fra Finn»." : "Ingen biler matcher filtrene."}
            </p>
          ) : (
            <ul className="grid gap-4">
              {visible.map(({ listing, result, distance }) => (
                <ListingCard key={listing.id} listing={listing} result={result} distance={distance} />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-muted">{props.label}</span>
        <span className="num font-medium">{props.display}</span>
      </span>
      <input
        type="range"
        className="range"
        style={{ "--pct": `${pct}%` } as CSSProperties}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ScrapeButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function run() {
    setBusy(true);
    setStatus("Søker på Finn…");
    try {
      let detailsOnly = false;
      for (let round = 0; round < 10; round++) {
        const res = await fetch(`/api/scrape${detailsOnly ? "?detailsOnly=1" : ""}`, { method: "POST" });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error ?? res.statusText);
        if (!detailsOnly) {
          setStatus(`${r.searchTotal} annonser · ${r.inserted} nye · ${r.priceChanges} prisendringer · ${r.deactivated} borte`);
        }
        if (r.detailsRemaining === 0 || r.detailsFetched === 0) {
          if (r.detailErrors) setStatus((s) => `${s} · ${r.detailErrors} feil ved henting av detaljer`);
          break;
        }
        setStatus((s) => `${s?.split(" · detaljer")[0]} · detaljer: ${r.detailsRemaining} igjen…`);
        detailsOnly = true;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus(`Feil: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={run} disabled={busy} className="btn btn-primary">
        {busy ? "Henter…" : "Hent fra Finn"}
      </button>
      {status && (
        <p role="status" className="num basis-full text-xs text-muted sm:order-first sm:basis-auto sm:max-w-sm sm:text-right">
          {status}
        </p>
      )}
    </>
  );
}
