-- Coche schema. Run once in Supabase SQL editor, then add `coche` to
-- Project Settings → API → Exposed schemas.

create schema if not exists coche;

create table if not exists coche.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'finn',
  external_id text not null,                  -- Finn-kode
  reg_nr text,                                -- normalized plate, e.g. EB12345
  vin text,
  url text not null,
  title text not null,
  model_spec text,                            -- seller's free-text variant line
  model_variant text,                         -- 'XC40' | 'EX40'
  drivetrain text,                            -- 'AWD' | 'RWD' | 'Unknown'
  range_variant text,                         -- 'twin' | 'extended' | 'standard' | 'unknown'
  trim_level text,                            -- 'Core' | 'Plus' | 'Ultimate' | 'Ultra' | 'Unknown'
  is_black_edition boolean default false,
  model_year int not null,
  mileage_km int not null,
  wltp_range_km int,
  price_nok int not null,                     -- Finn total price (incl. omreg)
  first_price_nok int not null,               -- price when first seen, for drop badge/sort
  omreg_fee_nok int,
  dealer_name text,
  location text,
  thumbnail_url text,
  published_at timestamptz,
  raw_equipment jsonb not null default '[]'::jsonb,   -- Finn "Utstyr" list
  description_text text,
  found_features jsonb not null default '[]'::jsonb,  -- feature keys detected in ad
  detail_fetched_at timestamptz,
  is_hidden boolean not null default false,
  is_favorite boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (source, external_id)
);

create index if not exists listings_active_idx on coche.listings (is_active);
create index if not exists listings_reg_nr_idx on coche.listings (reg_nr);

create table if not exists coche.price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references coche.listings(id) on delete cascade,
  price_nok int not null,
  recorded_at timestamptz not null default now()
);

create index if not exists price_history_listing_idx on coche.price_history (listing_id, recorded_at);

create table if not exists coche.user_preferences (
  id int primary key default 1 check (id = 1),
  max_price_nok int not null default 600000,
  max_mileage_km int not null default 50000,
  min_wltp_km int not null default 500,
  drivetrain text not null default 'all',     -- 'all' | 'awd' | 'rwd'
  sort text not null default 'score',         -- 'score' | 'price' | 'newest' | 'drop'
  feature_levels jsonb not null default '{}'::jsonb,  -- { featureKey: 'must'|'important'|'bonus'|'off' }
  updated_at timestamptz not null default now()
);

insert into coche.user_preferences (id) values (1) on conflict (id) do nothing;

-- Server-only access via service role. RLS on with no policies = anon/authenticated locked out.
alter table coche.listings enable row level security;
alter table coche.price_history enable row level security;
alter table coche.user_preferences enable row level security;

grant usage on schema coche to service_role;
grant all on all tables in schema coche to service_role;
alter default privileges in schema coche grant all on tables to service_role;
