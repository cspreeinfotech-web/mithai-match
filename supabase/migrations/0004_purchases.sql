create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  purchase_token text not null unique, -- the idempotency guard: replaying a token never grants twice
  order_id text,
  status text not null default 'pending' check (status in ('pending', 'granted', 'voided', 'failed')),
  price_micros bigint,
  currency text,
  granted_json jsonb, -- what was actually credited (coins/lives/etc.), for audit/debugging
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "purchases_select_own" on public.purchases
  for select using (auth.uid() = user_id);

-- Writes only via the verify-purchase Edge Function (service role), never a client insert/update.

create index if not exists purchases_user_id_idx on public.purchases (user_id);
