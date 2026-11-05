-- Remote-tweakable mirror of src/config/economy.config.ts — change a value here to push a
-- new price/reward without a release. The client fetches this on launch and falls back to
-- its bundled economy.config.ts if offline or this table is empty.
create table if not exists public.economy_config (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.economy_config enable row level security;

-- Public, read-only: every signed-in player (including anonymous) can read prices.
create policy "economy_config_select_all" on public.economy_config
  for select using (true);

-- No insert/update/delete policy — edit via the Supabase dashboard's table editor or the
-- SQL editor (service role), which bypasses RLS; see supabase/README.md.

insert into public.economy_config (key, value_json) values
  ('startingCoins', '100'),
  ('startingLives', '5'),
  ('maxLives', '5'),
  ('lifeRegenMinutes', '25'),
  ('coinsPerWin', '10'),
  ('coinsPerStar', '5'),
  ('boosterPrices', '{"hammer":60,"shuffle":40,"extraStriped":80,"extraMoves3":50}'),
  ('lifeRefillCoins', '120'),
  ('continueMovesCoinPrices', '[80,140,220]'),
  ('continueMovesGranted', '5'),
  ('maxContinuesPerAttempt', '3')
on conflict (key) do nothing;
