"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ListingRow, PrefsRow } from "@/lib/db";
import { FEATURES, LEVEL_LABEL, type Level } from "@/lib/features";
import { scoreListing } from "@/lib/score";
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
      })),
    [listings, levels],
  );

  const visible = useMemo(() => {
    const out = scored.filter(({ listing: l, result }) => {
      if (view === "hidden") return l.is_hidden;
      if (l.is_hidden) return false;
      if (view === "favorites" && !l.is_favorite) return false;
      if (l.price_nok > prefs.max_price_nok) return false;
      if (l.mileage_km > prefs.max_mileage_km) return false;
      if (l.wltp_range_km != null && l.wltp_range_km < prefs.min_wltp_km) return false;
      if (l.wltp_range_km == null && l.range_variant === "standard") return false;
      if (prefs.drivetrain === "awd" && l.drivetrain !== "AWD") return false;
      if (prefs.drivetrain === "rwd" && l.drivetrain !== "RWD") return false;
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
    };
    return out.sort(cmp[prefs.sort]);
  }, [scored, prefs, view]);

  const hiddenCount = listings.filter((l) => l.is_hidden).length;
  const favCount = listings.filter((l) => l.is_favorite && !l.is_hidden).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coche</h1>
          <p className="text-sm text-muted">Volvo XC40 Recharge / EX40 · 2024+ · Finn.no</p>
        </div>
        <div className="flex items-center gap-2">
          <ScrapeButton />
          <form action={logout}>
            <button className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">Logg ut</button>
          </form>
        </div>
      </header>

      {/* Top control bar */}
      <section className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <Slider label="Maks pris" value={prefs.max_price_nok} display={nok(prefs.max_price_nok)} min={350_000} max={700_000} step={10_000} onChange={(v) => set("max_price_nok", v)} />
          <Slider label="Maks km" value={prefs.max_mileage_km} display={km(prefs.max_mileage_km)} min={0} max={120_000} step={5_000} onChange={(v) => set("max_mileage_km", v)} />
          <Slider label="Min WLTP" value={prefs.min_wltp_km} display={km(prefs.min_wltp_km)} min={400} max={600} step={10} onChange={(v) => set("min_wltp_km", v)} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Drivlinje</span>
            <select value={prefs.drivetrain} onChange={(e) => set("drivetrain", e.target.value as PrefsRow["drivetrain"])} className="rounded-lg border border-line bg-panel px-2 py-1.5">
              <option value="all">Alle</option>
              <option value="awd">Kun Twin Motor AWD</option>
              <option value="rwd">Kun Extended Range RWD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Sortering</span>
            <select value={prefs.sort} onChange={(e) => set("sort", e.target.value as PrefsRow["sort"])} className="rounded-lg border border-line bg-panel px-2 py-1.5">
              <option value="score">Høyest score</option>
              <option value="price">Lavest pris</option>
              <option value="newest">Nyeste annonse</option>
              <option value="drop">Størst prisfall</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Feature drawer */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <button onClick={() => setDrawerOpen((o) => !o)} className="mb-2 w-full rounded-lg border border-line bg-panel px-3 py-2 text-left text-sm font-medium lg:hidden">
            Utstyr og vekting {drawerOpen ? "▴" : "▾"}
          </button>
          <div className={`${drawerOpen ? "block" : "hidden"} space-y-3 rounded-xl border border-line bg-panel p-3 lg:block`}>
            <h2 className="text-sm font-semibold">Utstyr og vekting</h2>
            {FEATURES.map((f) => (
              <div key={f.key}>
                <div className="mb-1 text-sm">{f.label}</div>
                <div className="flex gap-1">
                  {LEVELS.map((lv) => (
                    <button
                      key={lv}
                      onClick={() => set("feature_levels", { ...levels, [f.key]: lv })}
                      className={`flex-1 rounded-md px-1.5 py-1 text-xs transition ${
                        levels[f.key] === lv
                          ? lv === "must"
                            ? "bg-bad text-white"
                            : lv === "off"
                              ? "bg-muted text-panel"
                              : "bg-accent text-white"
                          : "bg-soft-bg text-muted hover:text-ink"
                      }`}
                    >
                      {LEVEL_LABEL[lv]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted">Må ha = skjuler biler som mangler det. Viktig = 15 p, Bonus = 5 p.</p>
          </div>
        </aside>

        <main>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            {(
              [
                ["all", `Alle (${visible.length})`],
                ["favorites", `Favoritter (${favCount})`],
                ["hidden", `Skjulte (${hiddenCount})`],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 ${view === v ? "bg-ink text-bg" : "bg-soft-bg text-muted hover:text-ink"}`}>
                {view === v && v !== "all" ? label.replace(/\(\d+\)/, `(${visible.length})`) : label}
              </button>
            ))}
            <span className="ml-auto text-muted">{listings.length} aktive annonser totalt</span>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
              {listings.length === 0 ? "Ingen annonser ennå — trykk «Hent fra Finn»." : "Ingen biler matcher filtrene."}
            </p>
          ) : (
            <ul className="grid gap-3">
              {visible.map(({ listing, result }) => (
                <ListingCard key={listing.id} listing={listing} result={result} />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        <span className="text-muted">{props.label}</span>
        <span className="font-medium tabular-nums">{props.display}</span>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
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
    <div className="flex items-center gap-3">
      {status && <span className="hidden max-w-md text-right text-xs text-muted sm:block">{status}</span>}
      <button onClick={run} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {busy ? "Henter…" : "Hent fra Finn"}
      </button>
    </div>
  );
}
