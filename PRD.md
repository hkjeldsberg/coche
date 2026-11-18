### Product Requirements Document (PRD): **Coche**

#### 1. Overview & Architecture

**Coche** is a personal used-car aggregator and deal-scoring web app built to hunt down **2024+ Volvo XC40 Recharge** and **Volvo EX40** listings across Norway.

* **Frontend & API:** Next.js (App Router) + TypeScript + Tailwind CSS, deployed on **Vercel**.
* **Database:** Supabase PostgreSQL using a dedicated **`coche`** schema.
* **Ingestion:** Manual only — "Hent fra Finn" button calls `POST /api/scrape` (no cron).

---

#### 1b. Decisions (2026-11-18)

* **No cron.** Manual trigger via dashboard button. `/api/scrape` runs the full search, then fetches ad detail pages until a 240 s budget; the button repeats with `?detailsOnly=1` until none remain.
* **Finn only** (v1). Scraping for personal use. Source = Finn search JSON API (`/mobility/search/api/search/SEARCH_ID_CAR_USED`, variants XC40 `1.818.2000437` + EX40 `1.818.2000669`, `fuel=4`, `year_from=2024`) + ad HTML (Spesifikasjoner / Utstyr / Beskrivelse).
* **Ingest wide, filter in UI.** Ingestion bounds = slider maxima (700k NOK, 120k km). Standard-range RWD is stored but hidden by the Min WLTP filter.
* **Weights:** `Må ha` = 15 p + hides cars missing it, `Viktig` = 15 p, `Bonus` = 5 p, `Av` = 0. Score = matched / active points × 100, computed live in the UI from `found_features`.
* **Trim detector:** Core / Plus / Ultimate (XC40) / Ultra (EX40) + Black Edition. Features not in the ad but standard on the detected trim count as matched and show as "≈ trolig standard" (map in `src/lib/features.ts` → `TRIM_STANDARD`, unverified assumption).
* **Price:** Finn total price (incl. omreg) is `price_nok`; omreg shown separately, never added twice. Price drop = `first_price_nok − price_nok`.
* **Sold detection:** Ad not present in a completed search → `is_active = false`.
* **Auth:** single password from `APP_PASSWORD`, HMAC-signed cookie (`SESSION_SECRET`), enforced in `src/proxy.ts`.
* **No notifications.**
* Schema in `supabase/migrations/001_coche.sql` supersedes §5.

#### 2. Hard Search Constraints (2024+ Facelift Baseline)

Because Volvo overhauled the drivetrain and battery for Model Year 2024 (82 kWh / 79 kWh net battery, RWD Single Motor Extended Range up to ~572 km WLTP, and updated AWD Twin Motor at ~521–538 km WLTP), **Coche** enforces the following baseline filters at ingestion:

* **Models:** `Volvo XC40` (Electric / Recharge) OR `Volvo EX40`
* **Model Year (`Årsmodell`):** $\ge 2024$ *(strictly excludes 2021–2023 pre-facelift models)*
* **Drivetrain Options:** Single Motor Extended Range (RWD) **OR** Twin Motor / Twin Motor Performance (AWD) *(excludes standard-range 69 kWh models under 500 km WLTP)*
* **Fuel & Gearbox:** `Elektrisk` + `Automat`
* **Default UI Sliders (Adjustable):**
* **Max Price:** `600 000 NOK` (adjustable slider: `350k – 700k`)
* **Max Mileage:** `50 000 km` (adjustable slider: `0 – 120 000 km`)
* **Min WLTP Range:** `500 km` (with fallback flag if WLTP is left blank on a 2024+ Extended Range / Twin Motor ad)



---

#### 3. Feature Scoring & "Missing Parts" Highlighting

Instead of hiding cars when a dealer forgets to tick a checkbox, **Coche** uses **weighted scoring** (0–100%) and **prominently surfaces missing equipment** directly on each listing card.

| Feature Toggle | Default Weight | Keywords / Parser Rules | Missing-Part Penalty & UI Alert |
| --- | --- | --- | --- |
| **Varme i rattet** | High (15 pts) | `oppvarmet ratt`, `varme i ratt`, `rattvarme` | Red warning badge (`Mangler rattvarme`) — flags potential EU import |
| **Ryggekamera** | High (15 pts) | `ryggekamera`, `parkeringskamera`, `360` | Red warning badge (`Mangler ryggekamera`) |
| **Varmepumpe** | High (15 pts) | `varmepumpe`, `heat pump` | Red warning badge (`Mangler varmepumpe`) — critical for Norwegian winter |
| **Twin Motor (AWD)** | Toggleable (15 pts) | `Twin Motor`, `AWD`, `4x4`, `firehjulsdrift`, `300 kW`, `408 hk`, `442 hk` | Neutral/Amber pill (`RWD — ikke AWD`) so you can compare RWD range vs. AWD traction |
| **Hengerfeste** | Medium (10 pts) | `hengerfeste`, `tilhengerfeste`, `semielektrisk` | Amber pill (`Mangler hengerfeste` — ~18k NOK retrofit cost) |
| **Vinterhjul inkludert** | Medium (10 pts) | `vinterhjul`, `vinterdekk`, `piggfri`, `piggdekk`, `2 sett hjul` | Amber pill (`Vinterhjul ikke nevnt` — ~15k NOK value) |
| **Adaptiv Cruise / Pilot Assist** | Medium (8 pts) | `adaptiv cruise`, `ACC`, `Pilot Assist` | Amber pill (`Mangler ACC`) |
| **360° Kamera** | Low (5 pts) | `360`, `360-kamera`, `360°` | Subtle pill (`Kun vanlig ryggekamera`) |
| **Harman Kardon Lyd** | Low (4 pts) | `Harman`, `Kardon`, `H/K` | Subtle pill (`Standard lydanlegg`) |
| **Praktisk bagasjerom** | Low (3 pts) | `skiluke`, `elektrisk bakluke`, `bagasjeromsmatte` | All EX40/XC40s have 410–452 L + 31 L frunk; highlights ski hatch & power tailgate |

* **Explicit "Missing Parts" Callout:** Every listing card renders a dedicated **`Mangler / Ikke oppgitt`** strip listing any active toggles not found in the ad's equipment table or free-text description, alongside a **Trim Detector** (`Core` vs `Plus` vs `Ultimate`/`Ultra` / `Black Edition`) so you immediately know whether a feature is genuinely absent or just omitted from the ad copy.

---

#### 4. Data Sources & Deduplication

1. **Finn.no:** Primary search feed + individual ad HTML/JSON state extraction (`utstyr`, `beskrivelse`, `regnr`, `chassisnr`, `omregistrering`, `forhandler`).
2. **Secondary Sites:** Bilia / Volvo Selekt, Rebil.no, Nettbil.no.
3. **Cross-Site Deduplication:** Normalizes `reg_nr` (e.g., `EB12345`) to merge duplicate listings across Finn and dealer portals, showing both links and highlighting if the dealer lists it cheaper on their own site.

---

#### 5. Supabase Database Schema (`coche`)

```sql
create schema if not exists coche;

create table coche.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null,                     -- 'finn', 'bilia', 'rebil', 'nettbil'
  external_id text not null,                -- e.g., Finn-kode
  reg_nr text,                              -- Normalized license plate for deduplication
  url text not null,
  title text not null,
  model_variant text,                       -- 'XC40 Recharge' | 'EX40'
  drivetrain text,                          -- 'RWD' | 'AWD'
  trim_level text,                          -- 'Core' | 'Plus' | 'Ultra' | 'Unknown'
  model_year int not null,
  mileage_km int not null,
  wltp_range_km int,
  price_nok int not null,
  omreg_fee_nok int default 0,
  dealer_name text,
  location text,
  thumbnail_url text,
  raw_equipment jsonb default '[]'::jsonb,  -- Structured equipment tags
  description_text text,
  matched_features jsonb default '[]'::jsonb,
  missing_features jsonb default '[]'::jsonb,
  match_score int default 0,                -- 0-100 calculated score
  is_hidden boolean default false,
  is_favorite boolean default false,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  is_active boolean default true,
  unique (source, external_id)
);

create table coche.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references coche.listings(id) on delete cascade,
  price_nok int not null,
  recorded_at timestamptz default now()
);

create table coche.user_preferences (
  id int primary key default 1,
  max_price_nok int default 600000,
  max_mileage_km int default 50000,
  require_awd boolean default false,
  feature_weights jsonb not null,           -- Stores custom toggle states & point weights
  updated_at timestamptz default now()
);

```

*(Remember to expose the `coche` schema in Supabase under **Project Settings → API → Exposed schemas** so PostgREST/Supabase JS client can query it directly).*

---

#### 6. UI / UX Layout (Next.js Dashboard)

* **Top Control Bar:** Live sliders for **Maks pris** (`600 000 kr`) and **Maks km** (`50 000 km`), drivetrain selector (`Alle` / `Kun Twin Motor AWD` / `Kun Extended Range RWD`), and sort dropdown (`Høyest score`, `Lavest pris`, `Nyeste annonse`, `Størst prisfall`).
* **Left Filter Drawer:** Interactive toggles for each feature with adjustable weight pills (`Må ha` / `Viktig` / `Bonus` / `Av`).
* **Listing Feed Cards:**
* **Header:** Car title, Year, Mileage, WLTP range badge, Drivetrain badge (`AWD Twin` vs `RWD Extended`), and **Score Pill** (e.g., `92% Match`).
* **Price Block:** Total price + Omregistrering, plus a green `-15 000 kr` delta badge if `coche.price_history` detected a drop.
* **Equipment Matrix:**
* **Green chips:** Confirmed features found in ad.
* **Red/Amber alert strip (`Mangler i annonsen`):** Explicitly calls out missing toggled features so you know what to verify with the seller before calling.


* **Quick Actions:** `Åpne på Finn`, `Favoritt`, `Skjul bil`.



---

#### 7. Vercel Deployment Considerations

* **Function timeout:** `/api/scrape` sets `maxDuration = 300` (Fluid compute). Search pages first, upsert, then detail pages 5 in parallel until the time budget; client repeats while details remain.
* **Auth:** Single-user password cookie (see 1b).

For a real-world look at how the 2024 facelift's range and efficiency perform in practice, check out this [Volvo EX40 2024 Update Range & Noise Test](https://www.youtube.com/watch?v=IvF9fMYylDo).