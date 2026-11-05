-- Player profile: one row per auth user, created automatically on first sign-in.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  coins integer not null default 100 check (coins >= 0),
  lives integer not null default 5 check (lives >= 0 and lives <= 5),
  lives_updated_at timestamptz not null default now(),
  current_level integer not null default 1 check (current_level >= 1),
  total_stars integer not null default 0 check (total_stars >= 0),
  shop_stage integer not null default 1 check (shop_stage >= 1),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  last_daily_claim timestamptz,
  language text not null default 'en' check (language in ('en', 'hi-roman')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Players can read only their own profile. No insert/update/delete policy is granted here
-- on purpose: coins/lives/etc. are server-authoritative and change only through the
-- SECURITY DEFINER RPCs in 0007_rpc_functions.sql, never a direct client write.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row the moment a new auth user (including an anonymous one) signs in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
