-- UPI intent payments + live admin panel. Every rule lives in the DB (RLS + SECURITY DEFINER
-- RPCs owned by postgres, which bypasses RLS) so the app/admin UI can never skip a check.

create schema if not exists private;
grant usage on schema private to authenticated, anon;

-- ============================== admins ==============================

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function private.is_admin(p_user_id uuid default auth.uid())
returns boolean language sql security definer set search_path = '' stable as $$
  select exists(select 1 from public.admins where user_id = p_user_id);
$$;

create or replace function private.is_owner(p_user_id uuid default auth.uid())
returns boolean language sql security definer set search_path = '' stable as $$
  select exists(select 1 from public.admins where user_id = p_user_id and role = 'owner');
$$;

grant execute on function private.is_admin(uuid) to authenticated, anon;
grant execute on function private.is_owner(uuid) to authenticated, anon;

create policy "admins_select_owner" on public.admins
  for select using (private.is_owner(auth.uid()));

-- admins is RLS-locked to owner-only reads, so a plain admin can't even see their own row —
-- which the admin panel's auth gate needs to do. This exposes just a boolean, nothing else.
create or replace function public.am_i_admin()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object('is_admin', private.is_admin(auth.uid()), 'is_owner', private.is_owner(auth.uid()));
$$;
grant execute on function public.am_i_admin() to authenticated;
revoke execute on function public.am_i_admin() from public, anon;

create or replace function private.protect_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare remaining_owners int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into remaining_owners from public.admins where role = 'owner' and user_id <> old.user_id;
    if remaining_owners = 0 then
      raise exception 'cannot remove or demote the last owner';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists admins_protect_last_owner on public.admins;
create trigger admins_protect_last_owner before update or delete on public.admins
  for each row execute function private.protect_last_owner();

-- Bootstraps the first owner. Only takes effect once this email has actually signed up
-- (via the app or Supabase Auth) — until then this is a no-op and needs re-running once it has.
insert into public.admins (user_id, role)
select id, 'owner' from auth.users where email = 'help.mithaimatch@gmail.com'
on conflict (user_id) do update set role = 'owner';

-- ============================== plans ==============================

create table if not exists public.plans (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  price_paise bigint not null check (price_paise > 0),
  duration_days int not null check (duration_days > 0),
  active bool not null default true,
  sort int not null default 0,
  perks text[] not null default '{}',
  badge text,
  free_eligible bool not null default false,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
-- No select/write policy: reads go through plans_for_me()/admin_plans(), writes through admin_*.

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (code, name, price_paise, duration_days, sort, perks, free_eligible)
values
  ('trial', 'Trial', 4900, 7, 1, array['All boosters unlocked', '7 days of play'], true),
  ('monthly', 'Monthly', 19900, 30, 2, array['All boosters unlocked', '30 days of play', 'No ads'], false),
  ('yearly', 'Yearly', 149900, 365, 3, array['All boosters unlocked', '365 days of play', 'No ads', 'Best value'], false)
on conflict (code) do nothing;

-- ============================== payment_settings ==============================

create table if not exists public.payment_settings (
  id int primary key default 1 check (id = 1),
  upi_id text check (upi_id ~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,64}$'),
  payee_name text check (char_length(payee_name) <= 100),
  enabled bool not null default false,
  activation_mode text not null default 'instant' check (activation_mode in ('instant', 'manual')),
  updated_at timestamptz not null default now()
);

alter table public.payment_settings enable row level security;

create policy "payment_settings_select_owner" on public.payment_settings
  for select using (private.is_owner(auth.uid()));
-- No write policy: only admin_set_upi/admin_clear_upi (SECURITY DEFINER) can change this row.

drop trigger if exists payment_settings_set_updated_at on public.payment_settings;
create trigger payment_settings_set_updated_at before update on public.payment_settings
  for each row execute function public.set_updated_at();

insert into public.payment_settings (id, upi_id, payee_name, enabled, activation_mode)
values (1, '2728412a@bandhan', 'AS Enterprice', true, 'instant')
on conflict (id) do update set
  upi_id = excluded.upi_id, payee_name = excluded.payee_name,
  enabled = excluded.enabled, activation_mode = excluded.activation_mode, updated_at = now();

-- ============================== payment_orders ==============================

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null,
  plan_name text not null,
  duration_days int not null,
  amount_paise bigint not null,
  reference text not null unique,
  status text not null default 'initiated' check (status in ('initiated', 'pending', 'success', 'failed', 'cancelled', 'revoked')),
  utr text unique,
  client_status text,
  raw_response text,
  reason text,
  activated_by text check (activated_by in ('auto', 'owner', 'webhook')),
  paid_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;
-- No select/write policy: own history via my_payment_orders(), admin via admin_payments(); writes RPC-only.

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at before update on public.payment_orders
  for each row execute function public.set_updated_at();

create index if not exists payment_orders_open_idx on public.payment_orders (user_id, plan_code, created_at)
  where status in ('initiated', 'pending');
create index if not exists payment_orders_paid_at_idx on public.payment_orders (paid_at)
  where status = 'success';

-- ============================== blocked_txn_ids ==============================

create table if not exists public.blocked_txn_ids (
  utr text primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_txn_ids enable row level security;
-- No policy at all: not readable or writable by anon/authenticated, only by SECURITY DEFINER RPCs.

-- ============================== subscriptions ==============================

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  order_id uuid references public.payment_orders (id)
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ============================== settings_audit ==============================

create table if not exists public.settings_audit (
  id bigint generated always as identity primary key,
  "table" text not null,
  row_id text,
  changed_by uuid,
  old jsonb,
  new jsonb,
  changed_at timestamptz not null default now()
);

alter table public.settings_audit enable row level security;
create policy "settings_audit_select_owner" on public.settings_audit
  for select using (private.is_owner(auth.uid()));

create or replace function private.audit_settings_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.settings_audit ("table", row_id, changed_by, old, new)
  values (tg_table_name, coalesce(new.id::text, old.id::text), auth.uid(), to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end;
$$;

drop trigger if exists plans_audit on public.plans;
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function private.audit_settings_change();

drop trigger if exists payment_settings_audit on public.payment_settings;
create trigger payment_settings_audit after insert or update or delete on public.payment_settings
  for each row execute function private.audit_settings_change();

-- ============================== settings_version ==============================

create table if not exists public.settings_version (
  id int primary key default 1 check (id = 1),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.settings_version enable row level security;
create policy "settings_version_select_all" on public.settings_version for select using (true);

insert into public.settings_version (id, version) values (1, 0) on conflict (id) do nothing;

create or replace function private.bump_settings_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.settings_version set version = version + 1, updated_at = now() where id = 1;
  return coalesce(new, old);
end;
$$;

drop trigger if exists plans_bump_version on public.plans;
create trigger plans_bump_version after insert or update or delete on public.plans
  for each row execute function private.bump_settings_version();

drop trigger if exists payment_settings_bump_version on public.payment_settings;
create trigger payment_settings_bump_version after insert or update or delete on public.payment_settings
  for each row execute function private.bump_settings_version();

-- ============================== app_mode ==============================

-- Free mode applies the same way to every user — there's no per-user segment (organic/ads) to target.
create table if not exists public.app_mode (
  id int primary key default 1 check (id = 1),
  free_mode bool not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_mode enable row level security;
create policy "app_mode_select_all" on public.app_mode for select using (true);

insert into public.app_mode (id, free_mode) values (1, false) on conflict (id) do nothing;

drop trigger if exists app_mode_set_updated_at on public.app_mode;
create trigger app_mode_set_updated_at before update on public.app_mode
  for each row execute function public.set_updated_at();
drop trigger if exists app_mode_bump_version on public.app_mode;
create trigger app_mode_bump_version after insert or update on public.app_mode
  for each row execute function private.bump_settings_version();

-- Realtime: the app subscribes to settings_version and reloads plans_for_me() on change.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings_version') then
    alter publication supabase_realtime add table public.settings_version;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plans') then
    alter publication supabase_realtime add table public.plans;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_mode') then
    alter publication supabase_realtime add table public.app_mode;
  end if;
end $$;

-- Lock every table down from direct client writes; all mutation goes through RPCs below.
revoke insert, update, delete on public.admins, public.plans, public.payment_settings,
  public.payment_orders, public.blocked_txn_ids, public.subscriptions, public.settings_audit,
  public.settings_version, public.app_mode from anon, authenticated;

-- ============================== helpers ==============================

-- Pulls one key=value pair out of a UPI app's raw response string (querystring-shaped).
create or replace function private.extract_param(p_raw text, p_key text)
returns text language sql security definer set search_path = '' immutable as $$
  select (regexp_match(p_raw, p_key || '=([^&]*)'))[1];
$$;

create or replace function private.gen_reference()
returns text language sql security definer set search_path = '' volatile as $$
  select 'BB' || upper(substr(replace(md5(random()::text || clock_timestamp()::text), '-', ''), 1, 10));
$$;

-- ============================== plans_for_me ==============================

create or replace function public.plans_for_me()
returns table (
  id bigint, code text, name text, price_paise bigint, duration_days int,
  perks text[], badge text, sort int, pay_mode text
)
language sql security definer set search_path = '' stable as $$
  select
    p.id, p.code, p.name, p.price_paise, p.duration_days, p.perks, p.badge, p.sort,
    case
      when am.free_mode then 'free'
      when p.free_eligible then 'free'
      when not coalesce(ps.enabled, false) or ps.upi_id is null then 'unavailable'
      else 'upi'
    end as pay_mode
  from public.plans p
  cross join public.app_mode am
  cross join public.payment_settings ps
  where p.active and am.id = 1 and ps.id = 1
  order by p.sort;
$$;
grant execute on function public.plans_for_me() to authenticated, anon;

-- ============================== create_payment_order ==============================

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
    insert into public.payment_orders (user_id, plan_code, plan_name, duration_days, amount_paise, reference, status)
    values (auth.uid(), v_plan.code, v_plan.name, v_plan.duration_days, v_plan.price_paise, v_reference, 'initiated')
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
grant execute on function public.create_payment_order(bigint) to authenticated;

-- ============================== report_payment_result ==============================

create or replace function public.report_payment_result(p_order_id uuid, p_raw_response text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.payment_orders;
  v_settings public.payment_settings;
  v_status_raw text;
  v_txn_ref text;
  v_txn_id text;
  v_recent_auto_count int;
  v_reason text;
  v_usable_utr text;
begin
  select * into v_order from public.payment_orders where id = p_order_id and user_id = auth.uid() for update;
  if v_order is null then
    raise exception 'order not found';
  end if;
  if v_order.status not in ('initiated', 'pending') then
    return to_jsonb(v_order);
  end if;

  if p_raw_response is null or trim(p_raw_response) = '' then
    -- back button / no response: leave it initiated, nothing to parse
    return to_jsonb(v_order);
  end if;

  update public.payment_orders set raw_response = left(p_raw_response, 2000), updated_at = now()
    where id = p_order_id;

  v_status_raw := upper(coalesce(private.extract_param(p_raw_response, 'Status'), private.extract_param(p_raw_response, 'status'), ''));
  v_txn_ref := coalesce(private.extract_param(p_raw_response, 'txnRef'), private.extract_param(p_raw_response, 'TxnRef'));
  v_txn_id := coalesce(private.extract_param(p_raw_response, 'ApprovalRefNo'), private.extract_param(p_raw_response, 'txnId'), private.extract_param(p_raw_response, 'TxnId'));

  update public.payment_orders set client_status = v_status_raw where id = p_order_id;

  if v_status_raw in ('FAILURE', 'FAILED') then
    update public.payment_orders set status = 'failed', reason = 'upi_failure', updated_at = now()
      where id = p_order_id returning * into v_order;
    return to_jsonb(v_order);
  end if;

  select * into v_settings from public.payment_settings where id = 1;
  v_usable_utr := case when v_txn_id ~ '^[A-Z0-9]{6,40}$'
    and not exists (select 1 from public.blocked_txn_ids where utr = v_txn_id)
    and not exists (select 1 from public.payment_orders where utr = v_txn_id and id <> v_order.id)
    then v_txn_id else null end;

  if v_status_raw = 'SUCCESS' and v_settings.activation_mode = 'instant' then
    if v_txn_ref is distinct from v_order.reference then
      v_reason := 'reference_mismatch';
    elsif v_txn_id is null or v_txn_id !~ '^[A-Z0-9]{6,40}$' then
      v_reason := 'bad_txn_id_format';
    elsif v_usable_utr is null then
      v_reason := 'txn_id_blocked_or_reused';
    elsif v_order.created_at < now() - interval '2 hours' then
      v_reason := 'order_too_old';
    else
      select count(*) into v_recent_auto_count from public.payment_orders
        where user_id = v_order.user_id and activated_by = 'auto' and paid_at > now() - interval '24 hours';
      if v_recent_auto_count >= 3 then
        v_reason := 'daily_auto_activation_cap';
      end if;
    end if;

    if v_reason is null then
      perform private.activate_payment(v_order.id, v_usable_utr, 'auto');
      select * into v_order from public.payment_orders where id = p_order_id;
      return to_jsonb(v_order);
    end if;
  elsif v_status_raw = 'SUBMITTED' then
    v_reason := 'submitted';
  elsif v_status_raw = 'SUCCESS' then
    v_reason := 'manual_review';
  else
    v_reason := 'unknown_status';
  end if;

  update public.payment_orders set status = 'pending', reason = v_reason, utr = v_usable_utr, updated_at = now()
    where id = p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;
grant execute on function public.report_payment_result(uuid, text) to authenticated;

-- ============================== activate_payment ==============================

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

  select ends_at into v_existing_ends from public.subscriptions where user_id = v_order.user_id;

  insert into public.subscriptions (user_id, plan_code, starts_at, ends_at, order_id)
  values (v_order.user_id, v_order.plan_code, now(), now() + (v_order.duration_days || ' days')::interval, v_order.id)
  on conflict (user_id) do update set
    plan_code = excluded.plan_code,
    starts_at = case when v_existing_ends > now() then public.subscriptions.starts_at else now() end,
    ends_at = (case when v_existing_ends > now() then v_existing_ends else now() end) + (v_order.duration_days || ' days')::interval,
    order_id = excluded.order_id;
end;
$$;

-- ============================== admin_mark_paid / admin_revoke_payment ==============================

create or replace function public.admin_mark_paid(p_order_id uuid, p_utr text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.payment_orders;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  if p_utr !~ '^[A-Z0-9]{6,40}$' then raise exception 'utr must be 6-40 uppercase alphanumeric characters'; end if;
  if exists (select 1 from public.blocked_txn_ids where utr = p_utr) then raise exception 'this utr is blocked'; end if;
  if exists (select 1 from public.payment_orders where utr = p_utr and id <> p_order_id) then raise exception 'this utr is already used'; end if;

  perform private.activate_payment(p_order_id, p_utr, 'owner');
  select * into v_order from public.payment_orders where id = p_order_id;
  return to_jsonb(v_order);
end;
$$;
grant execute on function public.admin_mark_paid(uuid, text) to authenticated;

create or replace function public.admin_revoke_payment(p_order_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.payment_orders;
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  select * into v_order from public.payment_orders where id = p_order_id for update;
  if v_order is null then raise exception 'order not found'; end if;

  update public.payment_orders set status = 'revoked', revoked_at = now(), reason = p_reason, updated_at = now()
    where id = p_order_id;
  update public.subscriptions set ends_at = now() where order_id = p_order_id;
  if v_order.utr is not null then
    insert into public.blocked_txn_ids (utr, reason) values (v_order.utr, p_reason) on conflict (utr) do nothing;
  end if;

  select * into v_order from public.payment_orders where id = p_order_id;
  return to_jsonb(v_order);
end;
$$;
grant execute on function public.admin_revoke_payment(uuid, text) to authenticated;

-- ============================== webhook_payment (service role only) ==============================

create or replace function public.webhook_payment(p_reference text, p_utr text, p_amount_paise bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.payment_orders;
begin
  select * into v_order from public.payment_orders
    where reference = p_reference and status in ('initiated', 'pending') for update;
  if v_order is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found_or_already_settled');
  end if;
  if v_order.amount_paise <> p_amount_paise then
    update public.payment_orders set status = 'pending', reason = 'amount_mismatch', updated_at = now() where id = v_order.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  perform private.activate_payment(v_order.id, p_utr, 'webhook');
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.webhook_payment(text, text, bigint) from public, anon, authenticated;
grant execute on function public.webhook_payment(text, text, bigint) to service_role;

-- ============================== claim_free_plan ==============================

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

  insert into public.payment_orders (user_id, plan_code, plan_name, duration_days, amount_paise, reference, status)
  values (auth.uid(), v_plan.code, v_plan.name, v_plan.duration_days, 0, private.gen_reference(), 'initiated')
  returning * into v_order;

  perform private.activate_payment(v_order.id, null, 'auto');
  select * into v_order from public.payment_orders where id = v_order.id;
  return to_jsonb(v_order);
end;
$$;
grant execute on function public.claim_free_plan(bigint) to authenticated;

-- ============================== my_payment_orders (app history screen) ==============================

create or replace function public.my_payment_orders(p_limit int default 20)
returns setof public.payment_orders language sql security definer set search_path = '' stable as $$
  select * from public.payment_orders where user_id = auth.uid() order by created_at desc limit p_limit;
$$;
grant execute on function public.my_payment_orders(int) to authenticated;

-- ============================== admin_* settings/plan management ==============================

create or replace function public.admin_set_upi(p_upi_id text, p_payee_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  if p_upi_id !~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,64}$' then raise exception 'invalid upi id'; end if;
  if char_length(p_payee_name) > 100 then raise exception 'payee name too long'; end if;
  update public.payment_settings set upi_id = p_upi_id, payee_name = p_payee_name, updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_set_upi(text, text) to authenticated;

create or replace function public.admin_clear_upi()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  update public.payment_settings set upi_id = null, payee_name = null, enabled = false, updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_clear_upi() to authenticated;

create or replace function public.admin_set_payments_enabled(p_enabled bool)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  update public.payment_settings set enabled = p_enabled, updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_set_payments_enabled(bool) to authenticated;

create or replace function public.admin_set_activation_mode(p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  if p_mode not in ('instant', 'manual') then raise exception 'invalid activation mode'; end if;
  update public.payment_settings set activation_mode = p_mode, updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_set_activation_mode(text) to authenticated;

create or replace function public.admin_payment_settings()
returns public.payment_settings language sql security definer set search_path = '' stable as $$
  select * from public.payment_settings where id = 1 and private.is_owner(auth.uid());
$$;
grant execute on function public.admin_payment_settings() to authenticated;

create or replace function public.admin_plans()
returns setof public.plans language sql security definer set search_path = '' stable as $$
  select * from public.plans where private.is_admin(auth.uid()) order by sort;
$$;
grant execute on function public.admin_plans() to authenticated;

create or replace function public.admin_create_plan(
  p_code text, p_name text, p_price_paise bigint, p_duration_days int,
  p_perks text[], p_badge text, p_sort int, p_free_eligible bool
) returns public.plans language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.plans (code, name, price_paise, duration_days, perks, badge, sort, free_eligible)
  values (p_code, p_name, p_price_paise, p_duration_days, coalesce(p_perks, '{}'), p_badge, p_sort, p_free_eligible)
  returning * into v_plan;
  return v_plan;
end;
$$;
grant execute on function public.admin_create_plan(text, text, bigint, int, text[], text, int, bool) to authenticated;

create or replace function public.admin_update_plan(
  p_id bigint, p_name text, p_price_paise bigint, p_duration_days int,
  p_perks text[], p_badge text, p_active bool, p_sort int, p_free_eligible bool
) returns public.plans language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  update public.plans set
    name = p_name, price_paise = p_price_paise, duration_days = p_duration_days,
    perks = coalesce(p_perks, '{}'), badge = p_badge, active = p_active, sort = p_sort,
    free_eligible = p_free_eligible, updated_at = now()
  where id = p_id returning * into v_plan;
  if v_plan is null then raise exception 'plan not found'; end if;
  return v_plan;
end;
$$;
grant execute on function public.admin_update_plan(bigint, text, bigint, int, text[], text, bool, int, bool) to authenticated;

create or replace function public.admin_set_free_mode(p_enabled bool)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  update public.app_mode set free_mode = p_enabled, updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_set_free_mode(bool) to authenticated;

-- ============================== admin_payments / admin_settings_history / admin_dashboard ==============================

create or replace function public.admin_payments(p_filter text default 'all', p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, user_id uuid, user_email text, plan_code text, plan_name text, amount_paise bigint,
  reference text, utr text, status text, reason text, activated_by text, created_at timestamptz, paid_at timestamptz
)
language sql security definer set search_path = '' stable as $$
  select o.id, o.user_id, u.email, o.plan_code, o.plan_name, o.amount_paise,
    o.reference, o.utr, o.status, o.reason, o.activated_by, o.created_at, o.paid_at
  from public.payment_orders o
  join auth.users u on u.id = o.user_id
  where private.is_admin(auth.uid())
    and (p_filter = 'all' or o.status = p_filter)
    and (p_search is null or p_search = '' or o.reference ilike '%' || p_search || '%'
         or o.utr ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%')
  order by o.created_at desc
  limit p_limit offset p_offset;
$$;
grant execute on function public.admin_payments(text, text, int, int) to authenticated;

create or replace function public.admin_settings_history(p_limit int default 50)
returns table (id bigint, "table" text, row_id text, changed_by_email text, old jsonb, new jsonb, changed_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select a.id, a."table", a.row_id, u.email, a.old, a.new, a.changed_at
  from public.settings_audit a
  left join auth.users u on u.id = a.changed_by
  where private.is_admin(auth.uid())
  order by a.changed_at desc limit p_limit;
$$;
grant execute on function public.admin_settings_history(int) to authenticated;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today bigint; v_7d bigint; v_30d bigint;
  v_success int; v_pending int; v_failed int; v_active_subs int;
begin
  if not private.is_admin(auth.uid()) then raise exception 'not authorized'; end if;

  select coalesce(sum(amount_paise), 0) into v_today from public.payment_orders where status = 'success' and paid_at >= date_trunc('day', now());
  select coalesce(sum(amount_paise), 0) into v_7d from public.payment_orders where status = 'success' and paid_at >= now() - interval '7 days';
  select coalesce(sum(amount_paise), 0) into v_30d from public.payment_orders where status = 'success' and paid_at >= now() - interval '30 days';
  select count(*) into v_success from public.payment_orders where status = 'success';
  select count(*) into v_pending from public.payment_orders where status = 'pending';
  select count(*) into v_failed from public.payment_orders where status = 'failed';
  select count(*) into v_active_subs from public.subscriptions where ends_at > now();

  return jsonb_build_object(
    'revenue_today_paise', v_today, 'revenue_7d_paise', v_7d, 'revenue_30d_paise', v_30d,
    'success_count', v_success, 'pending_count', v_pending, 'failed_count', v_failed,
    'active_subscribers', v_active_subs
  );
end;
$$;
grant execute on function public.admin_dashboard() to authenticated;

-- ============================== admin_users (Users page) ==============================

create or replace function public.admin_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (user_id uuid, email text, plan_code text, ends_at timestamptz, payment_count bigint)
language sql security definer set search_path = '' stable as $$
  select u.id, u.email, s.plan_code, s.ends_at, (select count(*) from public.payment_orders o where o.user_id = u.id and o.status = 'success')
  from auth.users u
  left join public.subscriptions s on s.user_id = u.id
  where private.is_admin(auth.uid())
    and (p_search is null or p_search = '' or u.email ilike '%' || p_search || '%')
  order by u.created_at desc
  limit p_limit offset p_offset;
$$;
grant execute on function public.admin_users(text, int, int) to authenticated;

-- ============================== admin_* admin-roster management (owner only) ==============================

create or replace function public.admin_admins()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select a.user_id, u.email, a.role, a.created_at
  from public.admins a join auth.users u on u.id = a.user_id
  where private.is_owner(auth.uid())
  order by a.created_at;
$$;
grant execute on function public.admin_admins() to authenticated;

create or replace function public.admin_add_admin(p_email text, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  if p_role not in ('owner', 'admin') then raise exception 'invalid role'; end if;
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then raise exception 'no user with that email has signed up yet'; end if;
  insert into public.admins (user_id, role) values (v_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
end;
$$;
grant execute on function public.admin_add_admin(text, text) to authenticated;

create or replace function public.admin_remove_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_owner(auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.admins where user_id = p_user_id;
end;
$$;
grant execute on function public.admin_remove_admin(uuid) to authenticated;

-- ============================== pg_cron: expire stale orders ==============================

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'cancel-stale-payment-orders') then
    perform cron.schedule(
      'cancel-stale-payment-orders',
      '*/15 * * * *',
      $job$ update public.payment_orders set status = 'cancelled', updated_at = now()
            where status in ('initiated', 'pending') and utr is null and created_at < now() - interval '24 hours'; $job$
    );
  end if;
end $$;
