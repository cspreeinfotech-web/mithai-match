-- apply_purchase must only ever run with the service-role key (called from the
-- verify-purchase Edge Function after independently verifying with Google) — a client
-- calling it directly over PostgREST could otherwise grant itself arbitrary coins/lives.
revoke execute on function public.apply_purchase(uuid, text, text, text, bigint, text, integer, integer) from anon, authenticated;

-- Pin the search_path so this trigger function can't be hijacked by a malicious search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Recreate as SECURITY INVOKER (the default/correct choice for a plain read-only view) —
-- it had picked up SECURITY DEFINER implicitly, which would run with the view creator's
-- privileges instead of the querying user's.
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select coalesce(display_name, 'Player') as display_name, total_stars
  from public.profiles
  order by total_stars desc
  limit 100;
