"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import type { ListingRow } from "@/lib/db";
import type { FeatureResult, ScoreResult } from "@/lib/score";
import { setListingFlag } from "@/app/actions";

const nok = (n: number) => `${n.toLocaleString("nb-NO")} kr`;

const SEVERITY_CLASS: Record<FeatureResult["severity"], string> = {
  red: "chip-must",
  amber: "chip-warning",
  subtle: "chip-subtle",
};

function scoreClass(score: number) {
  if (score >= 85) return "bg-positive text-ground";
  if (score >= 65) return "bg-warning text-ground";
  return "bg-must text-ground";
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
  const place = [l.location ?? l.kommune, l.fylke].filter(Boolean).join(", ");
  const drivetrainLabel =
    l.drivetrain === "AWD" ? "AWD Twin" : l.drivetrain === "RWD" ? (l.range_variant === "standard" ? "RWD Standard" : "RWD Extended") : "Drivlinje ?";

  return (
    <li className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Image panel */}
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-[16/9] w-full shrink-0 bg-raised sm:aspect-auto sm:min-h-56 sm:w-64 sm:border-r sm:border-line"
        >
          <CarGlyph />
          {l.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.thumbnail_url} alt={l.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className={`num absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreClass(result.score)}`}>
            {result.score}% match
          </span>
        </a>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
          {/* Title + price */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-lg font-bold leading-tight tracking-tight hover:text-accent sm:text-xl">
                {l.title} {l.model_variant && !l.title.includes(l.model_variant) ? l.model_variant : ""}
              </a>
              {l.model_spec && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted sm:line-clamp-1" title={l.model_spec}>
                  {l.model_spec}
                </p>
              )}
            </div>
            <div className="shrink-0 sm:text-right">
              <div className="num text-xl font-semibold sm:text-2xl">{nok(l.price_nok)}</div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {l.omreg_fee_nok != null && <span className="text-xs text-muted">inkl. omreg. <span className="num">{nok(l.omreg_fee_nok)}</span></span>}
                {drop > 0 && <span className="chip chip-positive num">−{nok(drop)}</span>}
                {drop < 0 && <span className="chip chip-must num">+{nok(-drop)}</span>}
              </div>
            </div>
          </div>

          {/* Spec pills */}
          <div className="flex flex-wrap gap-1.5">
            <Spec>{l.model_year}</Spec>
            <Spec>{l.mileage_km.toLocaleString("nb-NO")} km</Spec>
            {l.wltp_range_km != null ? <Spec>{l.wltp_range_km} km WLTP</Spec> : <span className="chip chip-warning">WLTP ukjent</span>}
            <Spec className={l.drivetrain === "AWD" ? "border-accent/50 text-accent" : ""}>{drivetrainLabel}</Spec>
            <span className="chip chip-outline">
              {trim ?? "Utstyrsnivå ukjent"}
              {l.is_black_edition ? " · Black Edition" : ""}
            </span>
          </div>

          {/* Equipment */}
          {pending && <p className="text-xs text-muted">Utstyrsliste ikke hentet ennå — vurdert kun fra overskrift.</p>}
          {found.length + standard.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {found.map((f) => (
                <span key={f.key} className="chip chip-positive">
                  ✓ {f.label}
                </span>
              ))}
              {standard.map((f) => (
                <span
                  key={f.key}
                  title={`Ikke nevnt i annonsen, men trolig standard på ${trim}`}
                  className="chip border border-dashed border-positive/40 text-positive"
                >
                  ≈ {f.label} <span className="font-medium opacity-70">std. {trim}</span>
                </span>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <div className="space-y-1.5">
              <div className="eyebrow">Mangler i annonsen</div>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((f) => (
                  <span key={f.key} className={`chip ${SEVERITY_CLASS[f.severity]}`}>
                    {f.missingLabel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Åpne på Finn
            </a>
            <button
              onClick={() => toggle("is_favorite")}
              aria-pressed={flags.fav}
              className={`btn ${flags.fav ? "bg-warning/15 text-warning ring-1 ring-warning/50" : "btn-ghost"}`}
            >
              {flags.fav ? "★" : "☆"} Favoritt
            </button>
            <button onClick={() => toggle("is_hidden")} className="btn btn-ghost font-medium text-muted">
              {flags.hidden ? "Vis igjen" : "Skjul"}
            </button>
          </div>

          {/* Footer meta */}
          <div className="num flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-muted">
            <span>
              {l.dealer_name ?? "Privat"}
              {l.reg_nr ? ` · ${l.reg_nr}` : ""}
            </span>
            {(place || distance != null) && (
              <span className="sm:ml-auto">
                {place}
                {distance != null ? ` · ${distance} km fra Oslo` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Spec({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`chip chip-outline num font-medium ${className}`}>{children}</span>;
}

/** Line-art car shown behind the photo (visible while loading or when the ad has no image). */
function CarGlyph() {
  return (
    <svg viewBox="0 0 120 60" aria-hidden className="absolute left-1/2 top-1/2 w-32 -translate-x-1/2 -translate-y-1/2 text-muted/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 44v-8c0-3 2-5 5-6l18-4 14-10c3-2 6-3 10-3h22c4 0 7 1 10 4l10 10 9 3c3 1 5 4 5 7v7" />
      <path d="M44 26l10-8h26l9 8z" />
      <circle cx="30" cy="46" r="8" />
      <circle cx="94" cy="46" r="8" />
      <path d="M38 46h48" />
    </svg>
  );
}
