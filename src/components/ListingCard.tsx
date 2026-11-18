"use client";

import { useOptimistic, useTransition } from "react";
import type { ListingRow } from "@/lib/db";
import type { FeatureResult, ScoreResult } from "@/lib/score";
import { setListingFlag } from "@/app/actions";

const nok = (n: number) => `${n.toLocaleString("nb-NO")} kr`;

const SEVERITY_CLASS: Record<FeatureResult["severity"], string> = {
  red: "bg-bad-bg text-bad",
  amber: "bg-warn-bg text-warn",
  subtle: "bg-soft-bg text-muted",
};

function scoreClass(score: number) {
  if (score >= 85) return "bg-good text-white";
  if (score >= 65) return "bg-warn text-white";
  return "bg-bad text-white";
}

export default function ListingCard({ listing: l, result, distance }: { listing: ListingRow; result: ScoreResult; distance: number | null }) {
  const [flags, setFlags] = useOptimistic({ fav: l.is_favorite, hidden: l.is_hidden });
  const [, startTransition] = useTransition();

  const toggle = (flag: "is_favorite" | "is_hidden") =>
    startTransition(async () => {
      const key = flag === "is_favorite" ? "fav" : "hidden";
      const next = !flags[key];
      setFlags({ ...flags, [key]: next });
      await setListingFlag(l.id, flag, next);
    });

  const drop = l.first_price_nok - l.price_nok;
  const found = result.features.filter((f) => f.status === "found");
  const standard = result.features.filter((f) => f.status === "standard");
  const missing = result.features.filter((f) => f.status === "missing");
  const trim = l.trim_level && l.trim_level !== "Unknown" ? l.trim_level : null;
  const pending = !l.detail_fetched_at;

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-col sm:flex-row">
        <a href={l.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[16/9] w-full shrink-0 bg-soft-bg sm:aspect-[4/3] sm:w-56">
          {l.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.thumbnail_url} alt={l.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreClass(result.score)}`}>
            {result.score}% match
          </span>
        </a>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                {l.title} {l.model_variant && !l.title.includes(l.model_variant) ? l.model_variant : ""}
              </a>
              <p className="truncate text-sm text-muted" title={l.model_spec ?? ""}>
                {l.model_spec}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <Pill>{l.model_year}</Pill>
                <Pill>{l.mileage_km.toLocaleString("nb-NO")} km</Pill>
                {l.wltp_range_km != null ? (
                  <Pill>{l.wltp_range_km} km WLTP</Pill>
                ) : (
                  <Pill className="bg-warn-bg text-warn">WLTP ukjent</Pill>
                )}
                <Pill className={l.drivetrain === "AWD" ? "bg-accent/15 text-accent" : ""}>
                  {l.drivetrain === "AWD" ? "AWD Twin" : l.drivetrain === "RWD" ? (l.range_variant === "standard" ? "RWD Standard" : "RWD Extended") : "Drivlinje ukjent"}
                </Pill>
                <Pill>
                  {trim ?? "Utstyrsnivå ukjent"}
                  {l.is_black_edition ? " · Black Edition" : ""}
                </Pill>
                {(l.location || distance != null) && (
                  <Pill>
                    {l.location ?? l.kommune}
                    {l.fylke ? `, ${l.fylke}` : ""}
                    {distance != null ? ` · ${distance} km fra Oslo` : ""}
                  </Pill>
                )}
              </div>
            </div>

            {/* Price block */}
            <div className="sm:text-right">
              <div className="text-xl font-semibold tabular-nums">{nok(l.price_nok)}</div>
              {l.omreg_fee_nok != null && <div className="text-xs text-muted">inkl. omreg. {nok(l.omreg_fee_nok)}</div>}
              {drop > 0 && <div className="mt-1 inline-block rounded-full bg-good-bg px-2 py-0.5 text-xs font-medium text-good">−{nok(drop)}</div>}
              {drop < 0 && <div className="mt-1 inline-block rounded-full bg-bad-bg px-2 py-0.5 text-xs font-medium text-bad">+{nok(-drop)}</div>}
            </div>
          </div>

          {/* Equipment matrix */}
          {pending && <p className="text-xs text-muted">Utstyrsliste ikke hentet ennå — vurdert kun fra overskrift.</p>}
          {found.length + standard.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {found.map((f) => (
                <span key={f.key} className="rounded-full bg-good-bg px-2 py-0.5 text-good">
                  ✓ {f.label}
                </span>
              ))}
              {standard.map((f) => (
                <span key={f.key} title={`Ikke nevnt i annonsen, men trolig standard på ${trim}`} className="rounded-full border border-dashed border-good/50 px-2 py-0.5 text-good">
                  ≈ {f.label} (std. {trim})
                </span>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <div className="rounded-lg border border-line p-2">
              <div className="mb-1 text-xs font-medium text-muted">Mangler i annonsen</div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {missing.map((f) => (
                  <span key={f.key} className={`rounded-full px-2 py-0.5 ${SEVERITY_CLASS[f.severity]}`}>
                    {f.missingLabel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-wrap items-center gap-2 text-sm">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90">
              Åpne på Finn
            </a>
            <button onClick={() => toggle("is_favorite")} className={`rounded-lg border px-3 py-1.5 ${flags.fav ? "border-warn bg-warn-bg text-warn" : "border-line hover:bg-soft-bg"}`}>
              {flags.fav ? "★ Favoritt" : "☆ Favoritt"}
            </button>
            <button onClick={() => toggle("is_hidden")} className="rounded-lg border border-line px-3 py-1.5 text-muted hover:bg-soft-bg">
              {flags.hidden ? "Vis igjen" : "Skjul bil"}
            </button>
            <span className="ml-auto text-xs text-muted">
              {l.dealer_name ?? "Privat"}
              {l.reg_nr ? ` · ${l.reg_nr}` : ""}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full bg-soft-bg px-2 py-0.5 ${className}`}>{children}</span>;
}
