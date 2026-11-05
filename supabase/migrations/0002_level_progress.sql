create table if not exists public.level_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  level_id integer not null check (level_id >= 1),
  best_score integer not null default 0 check (best_score >= 0),
  stars smallint not null default 0 check (stars between 0 and 3),
  attempts integer not null default 0 check (attempts >= 0),
  completed_at timestamptz,
  primary key (user_id, level_id)
);

alter table public.level_progress enable row level security;

create policy "level_progress_select_own" on public.level_progress
  for select using (auth.uid() = user_id);

-- Writes only via the complete_level() RPC (0007_rpc_functions.sql) — no client insert/update policy.
