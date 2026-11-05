create table if not exists public.inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (item_id in ('hammer', 'shuffle', 'extraStriped', 'extraMoves3')),
  quantity integer not null default 0 check (quantity >= 0),
  primary key (user_id, item_id)
);

alter table public.inventory enable row level security;

create policy "inventory_select_own" on public.inventory
  for select using (auth.uid() = user_id);

-- Writes only via spend_coins()/grant_coins()-style RPCs that also adjust inventory
-- (see 0007_rpc_functions.sql) — no client insert/update policy.
