
  1. Vercel plan. Hobby cron runs only once per day, so the 30–60 min schedule needs Pro, or GitHub Actions / Supabase pg_cron calling the
     endpoint. The 10–60s timeout in §7 is also outdated: Fluid compute gives up to 300s on Hobby. Which plan are you on?
  2. Finn access. There's no public search API, so this means scraping HTML or __NEXT_DATA__/JSON state. Vercel IPs may get blocked. Are you OK
     with scraping for personal use? Fallback could be a local runner.
  3. MVP scope. I'd suggest Finn only in v1. Bilia/Selekt listings mostly show up on Finn anyway. Nettbil is an auction, so its "price" is a
     bid, which is a different kind of number. Rebil and Nettbil in phase 2?
  4. What "Må ha" means. Hard filter (car hidden if the feature is missing) or just max weight? And how do the pills map to points? Suggestion:
     Må ha = filter + weight, Viktig = 15, Bonus = 5, Av = 0. Score = matched / sum of active weights × 100.
  5. Auth. Password cookie (simplest, recommended) or Supabase Auth? The cron endpoint also needs a CRON_SECRET header check.
  6. Notifications. None in the PRD. Do you want email/push on a new match above X% or a price drop? This affects the schema.
  7. Infra ready? Do the Supabase project and Vercel project exist? I'll need SUPABASE_URL and a service role key in env.


1. no cron, remove this - i will trigger manually
2. OK for personal use
3. FINN only ok
4. do the recommendationn
5. auth = single user password set in .env 
6. none
7. yes they exist. i will add in .env exameple and local (i cpied over some from another porject)