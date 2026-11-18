# Coche — v1 (Finn only)

- [x] Probe Finn: search JSON API + ad HTML structure, variant codes
- [x] Scaffold Next.js 16 + Tailwind 4 + Supabase client + vitest
- [x] Schema `supabase/migrations/001_coche.sql`
- [x] Parser (`src/lib/parse.ts`): specs, equipment, description, drivetrain, range variant, trim, features w/ negation
- [x] Scoring (`src/lib/score.ts`): weights, must-have, trim-standard
- [x] Ingest (`src/lib/ingest.ts`): search → upsert → price history → deactivate gone → detail fetch w/ time budget
- [x] Auth: password + HMAC cookie, `src/proxy.ts`
- [x] Dashboard: sliders, drivetrain, sort, weight drawer, cards, missing strip, favorite/hide, scrape button
- [x] Tests (16) green, build green, live parser check on 7 real ads
- [ ] **User:** run migration SQL + expose `coche` schema in Supabase
- [ ] First real ingest + UI check in browser
- [ ] Verify `TRIM_STANDARD` against Volvo NO equipment lists
- [ ] Deploy to Vercel (env: APP_PASSWORD, SESSION_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

## Review
- Finn exposes a clean JSON search API — no HTML scraping needed for the list; only detail pages are HTML (cheerio).
- Score is computed client-side from stored `found_features`, so weight changes apply instantly without re-ingest.
