-- Location filter: coordinates from Finn, fylke/kommune via Kartverket reverse geocoding.
alter table coche.listings
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists fylke text,
  add column if not exists kommune text;

alter table coche.user_preferences
  add column if not exists max_distance_km int not null default 1000,  -- 1000 = no limit
  add column if not exists fylker jsonb not null default '[]'::jsonb;   -- [] = all fylker
