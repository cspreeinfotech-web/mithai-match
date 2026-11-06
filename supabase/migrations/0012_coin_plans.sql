-- Plans used to grant time-based subscriptions (trial/monthly/yearly). The user wants UPI
-- plans to be coin packs instead — buy once, get coins, same idea as the Play Billing Store
-- but paid via UPI. duration_days becomes optional (0 = no subscription, just a coin grant).
--
-- Note: plans_for_me() keeps its original 9-column shape and is superseded by
-- plans_for_me_v2() (10 columns, adds `coins`) rather than being dropped/redefined —
-- Postgres won't let CREATE OR REPLACE change a table-returning function's output columns,
-- and this project's tooling can't get interactive confirmation for a DROP FUNCTION.

alter table public.plans add column if not exists coins bigint not null default 0;
alter table public.plans drop constraint if exists plans_duration_days_check;
alter table public.plans add constraint plans_duration_days_check check (duration_days >= 0);

update public.plans set active = false where code in ('trial', 'monthly', 'yearly');

insert into public.plans (code, name, price_paise, duration_days, coins, sort, perks, badge, free_eligible)
values
  ('coins_100', '100 Coins', 1900, 0, 100, 1, array['100 Coins'], null, true),
  ('coins_550', '550 Coins', 9900, 0, 550, 2, array['550 Coins', '+10% bonus'], 'POPULAR', false),
  ('coins_1200', '1200 Coins', 19900, 0, 1200, 3, array['1200 Coins', '+20% bonus'], 'BEST VALUE', false),
  ('coins_3000', '3000 Coins', 49900, 0, 3000, 4, array['3000 Coins', '+35% bonus'], null, false)
on conflict (code) do update set
  name = excluded.name, price_paise = excluded.price_paise, duration_days = excluded.duration_days,
  coins = excluded.coins, sort = excluded.sort, perks = excluded.perks, badge = excluded.badge,
  free_eligible = excluded.free_eligible, active = true;

create or replace function public.plans_for_me_v2()
returns table (
  id bigint, code text, name text, price_paise bigint, duration_days int,
  perks text[], badge text, sort int, pay_mode text, coins bigint
)
language sql security definer set search_path = '' stable as $$
  select
    p.id, p.code, p.name, p.price_paise, p.duration_days, p.perks, p.badge, p.sort,
    case
      when am.free_mode then 'free'
      when p.free_eligible then 'free'
      when not coalesce(ps.enabled, false) or ps.upi_id is null then 'unavailable'
      else 'upi'
    end as pay_mode,
    p.coins
  from public.plans p
  cross join public.app_mode am
  cross join public.payment_settings ps
  where p.active and am.id = 1 and ps.id = 1
  order by p.sort;
$$;
grant execute on function public.plans_for_me_v2() to authenticated, anon;

-- Only create/extend a subscription row when the plan still has a duration. Coin packs have
-- duration_days = 0 and grant nothing server-side — the client credits coins into the local
-- wallet once buyPlan()/claimFreePlan() reports a 'success' order (see grantOrderOnce()).
create or replace function private.activate_payment(p_order_id uuid, p_utr text, p_activated_by text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.payment_orders;
  v_existing_ends timestamptz;
begin
  select * into v_order from public.payment_orders where id = p_order_id for update;
  if v_order.status = 'success' then
    return; -- idempotent
  end if;

  update public.payment_orders
    set status = 'success', paid_at = now(), utr = p_utr, activated_by = p_activated_by, updated_at = now()
    where id = p_order_id;

  if v_order.duration_days > 0 then
    select ends_at into v_existing_ends from public.subscriptions where user_id = v_order.user_id;

    insert into public.subscriptions (user_id, plan_code, starts_at, ends_at, order_id)
    values (v_order.user_id, v_order.plan_code, now(), now() + (v_order.duration_days || ' days')::interval, v_order.id)
    on conflict (user_id) do update set
      plan_code = excluded.plan_code,
      starts_at = case when v_existing_ends > now() then public.subscriptions.starts_at else now() end,
      ends_at = (case when v_existing_ends > now() then v_existing_ends else now() end) + (v_order.duration_days || ' days')::interval,
      order_id = excluded.order_id;
  end if;
end;
$$;

-- Snapshot the coin amount onto the order at creation time (like duration_days already is),
-- so a later admin edit to the plan can't change what an in-flight/completed order pays out.
alter table public.payment_orders add column if not exists coins bigint not null default 0;

create or replace function public.create_payment_order(p_plan_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_is_anon boolean;
  v_plan public.plans;
  v_settings public.payment_settings;
  v_order public.payment_orders;
  v_reference text;
begin
  select is_anonymous into v_is_anon from auth.users where id = auth.uid();
  if auth.uid() is null or v_is_anon then
    raise exception 'must be signed in with an account to buy a plan';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and active;
  if v_plan is null then
    raise exception 'plan not available';
  end if;

  select * into v_settings from public.payment_settings where id = 1;
  if not coalesce(v_settings.enabled, false) or v_settings.upi_id is null then
    raise exception 'payments are not available right now';
  end if;

  select * into v_order from public.payment_orders
    where user_id = auth.uid() and plan_code = v_plan.code and status = 'initiated'
      and created_at > now() - interval '30 minutes'
    order by created_at desc limit 1 for update;

  if v_order is null then
    update public.payment_orders set status = 'cancelled', updated_at = now()
      where user_id = auth.uid() and status = 'initiated';

    v_reference := private.gen_reference();
    insert into public.payment_orders (user_id, plan_code, plan_name, duration_days, coins, amount_paise, reference, status)
    values (auth.uid(), v_plan.code, v_plan.name, v_plan.duration_days, v_plan.coins, v_plan.price_paise, v_reference, 'initiated')
    returning * into v_order;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'reference', v_order.reference,
    'amount', to_char(v_order.amount_paise / 100.0, 'FM999999990.00'),
    'upi_id', v_settings.upi_id,
    'payee_name', v_settings.payee_name,
    'status', v_order.status
  );
end;
$$;

create or replace function public.claim_free_plan(p_plan_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_is_anon boolean;
  v_plan public.plans;
  v_free_mode boolean;
  v_order public.payment_orders;
begin
  select is_anonymous into v_is_anon from auth.users where id = auth.uid();
  if auth.uid() is null or v_is_anon then raise exception 'must be signed in with an account'; end if;

  select * into v_plan from public.plans where id = p_plan_id and active;
  if v_plan is null then raise exception 'plan not available'; end if;

  select free_mode into v_free_mode from public.app_mode where id = 1;
  if not (v_free_mode or v_plan.free_eligible) then raise exception 'this plan is not free'; end if;

  if exists (select 1 from public.payment_orders where user_id = auth.uid() and plan_code = v_plan.code and amount_paise = 0 and status = 'success') then
    raise exception 'already_claimed';
  end if;

  insert into public.payment_orders (user_id, plan_code, plan_name, duration_days, coins, amount_paise, reference, status)
  values (auth.uid(), v_plan.code, v_plan.name, v_plan.duration_days, v_plan.coins, 0, private.gen_reference(), 'initiated')
  returning * into v_order;

  perform private.activate_payment(v_order.id, null, 'auto');
  select * into v_order from public.payment_orders where id = v_order.id;
  return to_jsonb(v_order);
end;
$$;

-- admin_create_plan/admin_update_plan: p_coins appended at the end with a default, since
-- Postgres allows CREATE OR REPLACE to add new input parameters only at the end of the list.
create or replace function public.admin_create_plan(
  p_code text, p_name text, p_price_paise bigint, p_duration_days int,
  p_perks text[], p_badge text, p_sort int, p_free_eligible bool, p_coins bigint default 0
) returns public.plans language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.plans (code, name, price_paise, duration_days, perks, badge, sort, free_eligible, coins)
  values (p_code, p_name, p_price_paise, p_duration_days, coalesce(p_perks, '{}'), p_badge, p_sort, p_free_eligible, p_coins)
  returning * into v_plan;
  return v_plan;
end;
$$;
grant execute on function public.admin_create_plan(text, text, bigint, int, text[], text, int, bool, bigint) to authenticated;

create or replace function public.admin_update_plan(
  p_id bigint, p_name text, p_price_paise bigint, p_duration_days int,
  p_perks text[], p_badge text, p_active bool, p_sort int, p_free_eligible bool, p_coins bigint default 0
) returns public.plans language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  update public.plans set
    name = p_name, price_paise = p_price_paise, duration_days = p_duration_days,
    perks = coalesce(p_perks, '{}'), badge = p_badge, active = p_active, sort = p_sort,
    free_eligible = p_free_eligible, coins = p_coins, updated_at = now()
  where id = p_id returning * into v_plan;
  if v_plan is null then raise exception 'plan not found'; end if;
  return v_plan;
end;
$$;
grant execute on function public.admin_update_plan(bigint, text, bigint, int, text[], text, bool, int, bool, bigint) to authenticated;
