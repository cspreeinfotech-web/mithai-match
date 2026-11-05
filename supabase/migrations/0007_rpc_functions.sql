-- Server-authoritative economy: every balance change goes through one of these
-- SECURITY DEFINER functions, each scoped to auth.uid() (never a client-supplied user id,
-- so a player can never spend/grant on someone else's account). RLS on the tables above has
-- no insert/update policy, so these functions are the only way balances move.

create or replace function public.regenerate_lives()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_interval_minutes constant int := 25;
  v_max_lives constant int := 5;
  v_elapsed_minutes int;
  v_gained int;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'profile not found';
  end if;

  if v_profile.lives < v_max_lives then
    v_elapsed_minutes := floor(extract(epoch from (now() - v_profile.lives_updated_at)) / 60);
    v_gained := floor(v_elapsed_minutes::numeric / v_interval_minutes);
    if v_gained > 0 then
      update public.profiles
        set lives = least(v_max_lives, lives + v_gained),
            lives_updated_at = lives_updated_at + make_interval(mins => v_gained * v_interval_minutes)
        where id = auth.uid()
        returning * into v_profile;
    end if;
  end if;

  return v_profile;
end;
$$;

create or replace function public.spend_coins(p_amount integer)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.profiles
    set coins = coins - p_amount
    where id = auth.uid() and coins >= p_amount
    returning * into v_profile;

  if not found then
    raise exception 'insufficient coins';
  end if;

  return v_profile;
end;
$$;

create or replace function public.grant_coins(p_amount integer)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.profiles
    set coins = coins + p_amount
    where id = auth.uid()
    returning * into v_profile;

  if not found then
    raise exception 'profile not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.use_life()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  perform public.regenerate_lives();

  update public.profiles
    set lives = lives - 1, lives_updated_at = now()
    where id = auth.uid() and lives > 0
    returning * into v_profile;

  if not found then
    raise exception 'no lives remaining';
  end if;

  return v_profile;
end;
$$;

create or replace function public.buy_booster(p_item_id text, p_cost integer)
returns public.inventory
language plpgsql
security definer set search_path = public
as $$
declare
  v_inventory public.inventory;
begin
  perform public.spend_coins(p_cost);

  insert into public.inventory (user_id, item_id, quantity)
    values (auth.uid(), p_item_id, 1)
    on conflict (user_id, item_id) do update set quantity = public.inventory.quantity + 1
    returning * into v_inventory;

  return v_inventory;
end;
$$;

create or replace function public.use_booster(p_item_id text)
returns public.inventory
language plpgsql
security definer set search_path = public
as $$
declare
  v_inventory public.inventory;
begin
  update public.inventory
    set quantity = quantity - 1
    where user_id = auth.uid() and item_id = p_item_id and quantity > 0
    returning * into v_inventory;

  if not found then
    raise exception 'no % remaining', p_item_id;
  end if;

  return v_inventory;
end;
$$;

create or replace function public.buy_decoration(p_decoration_id text, p_cost integer)
returns public.shop_upgrades
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.shop_upgrades;
begin
  if exists (select 1 from public.shop_upgrades where user_id = auth.uid() and upgrade_id = p_decoration_id) then
    raise exception 'already owned';
  end if;

  perform public.spend_coins(p_cost);

  insert into public.shop_upgrades (user_id, upgrade_id)
    values (auth.uid(), p_decoration_id)
    returning * into v_row;

  return v_row;
end;
$$;

-- Mirrors src/core/daily.ts: resets the streak if a calendar day was skipped, otherwise
-- advances it; wraps the 7-day reward table. Keep the two in sync if you tune the rewards.
create or replace function public.claim_daily_reward()
returns table (profile public.profiles, streak_day integer, coins_granted integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_last_day date;
  v_missed boolean;
  v_next_streak integer;
  v_streak_day integer;
  v_coins integer;
  v_rewards constant integer[] := array[20, 30, 40, 30, 60, 80, 150];
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'profile not found';
  end if;

  v_last_day := case when v_profile.last_daily_claim is null then null
                      else (v_profile.last_daily_claim at time zone 'utc')::date end;

  if v_last_day is not null and v_last_day >= v_today then
    raise exception 'already claimed today';
  end if;

  v_missed := v_last_day is not null and (v_today - v_last_day) > 1;
  v_next_streak := case when v_last_day is null or v_missed then 1 else v_profile.daily_streak + 1 end;
  v_streak_day := ((v_next_streak - 1) % 7) + 1;
  v_coins := v_rewards[v_streak_day];

  update public.profiles
    set daily_streak = v_next_streak,
        last_daily_claim = now(),
        coins = coins + v_coins
    where id = auth.uid()
    returning * into v_profile;

  -- Day 4 and day 7 also grant a booster, matching src/config/economy.config.ts.
  if v_streak_day = 4 then
    insert into public.inventory (user_id, item_id, quantity) values (auth.uid(), 'shuffle', 1)
      on conflict (user_id, item_id) do update set quantity = public.inventory.quantity + 1;
  elsif v_streak_day = 7 then
    insert into public.inventory (user_id, item_id, quantity) values (auth.uid(), 'extraStriped', 1)
      on conflict (user_id, item_id) do update set quantity = public.inventory.quantity + 1;
  end if;

  return query select v_profile, v_streak_day, v_coins;
end;
$$;

create or replace function public.complete_level(p_level_id integer, p_score integer, p_stars smallint)
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
  v_previous_best_stars smallint;
  v_coins integer;
begin
  if p_stars < 0 or p_stars > 3 then
    raise exception 'stars must be 0-3';
  end if;

  select coalesce(stars, 0) into v_previous_best_stars
    from public.level_progress where user_id = auth.uid() and level_id = p_level_id;

  insert into public.level_progress (user_id, level_id, best_score, stars, attempts, completed_at)
    values (auth.uid(), p_level_id, p_score, p_stars, 1, case when p_stars > 0 then now() else null end)
  on conflict (user_id, level_id) do update
    set best_score = greatest(public.level_progress.best_score, excluded.best_score),
        stars = greatest(public.level_progress.stars, excluded.stars),
        attempts = public.level_progress.attempts + 1,
        completed_at = case when excluded.stars > 0 then now() else public.level_progress.completed_at end;

  v_coins := case when p_stars > 0 then 10 + p_stars * 5 else 0 end;

  update public.profiles
    set coins = coins + v_coins,
        current_level = case when p_stars > 0 then greatest(current_level, p_level_id + 1) else current_level end,
        total_stars = total_stars + greatest(0, p_stars - v_previous_best_stars)
    where id = auth.uid()
    returning * into v_profile;

  return v_profile;
end;
$$;
