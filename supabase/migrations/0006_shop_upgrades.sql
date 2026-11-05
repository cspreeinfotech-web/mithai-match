create table if not exists public.shop_upgrades (
  user_id uuid not null references auth.users (id) on delete cascade,
  upgrade_id text not null, -- matches a decoration id from src/config/shop.config.ts
  unlocked_at timestamptz not null default now(),
  primary key (user_id, upgrade_id)
);

alter table public.shop_upgrades enable row level security;

create policy "shop_upgrades_select_own" on public.shop_upgrades
  for select using (auth.uid() = user_id);

-- Writes only via buy_decoration() (0007_rpc_functions.sql) — no client insert/update policy.
