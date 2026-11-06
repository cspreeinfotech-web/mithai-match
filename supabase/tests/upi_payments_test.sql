-- Exercises every rule from the UPI payments spec against the real functions/tables.
-- Runs inside one transaction that always rolls back at the end, so it never leaves test
-- data behind. Run with: supabase db execute --file supabase/tests/upi_payments_test.sql
-- (or paste into the SQL editor) against a project that already has migration 0011 applied.

begin;

-- Test fixtures: two ordinary users + one extra for the admin negative-test, all non-anonymous.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-buyer@example.com', '', now(), '{}', '{}', false, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-owner@example.com', '', now(), '{}', '{}', false, now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-nobody@example.com', '', now(), '{}', '{}', false, now(), now());

insert into public.admins (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'owner');

do $$
declare v_order_id uuid; v_reference text; v_result jsonb; v_plan_id bigint; v_price bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  select id, price_paise into v_plan_id, v_price from public.plans where code = 'coins_100';

  -- 1. reference mismatch -> pending, not success
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid;
  v_reference := v_result->>'reference';
  v_result := public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=WRONGREF&txnId=ABC123XYZ9');
  if v_result->>'status' <> 'pending' then
    raise exception 'TEST FAILED: reference mismatch should go to pending, got %', v_result->>'status';
  end if;
  if v_result->>'reason' <> 'reference_mismatch' then
    raise exception 'TEST FAILED: expected reason reference_mismatch, got %', v_result->>'reason';
  end if;

  -- 2. a reused UTR is rejected: order A activates with UTR X, order B (same user) tries X too
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid;
  v_reference := v_result->>'reference';
  v_result := public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=' || v_reference || '&txnId=REUSEDTXN01');
  if v_result->>'status' <> 'success' then
    raise exception 'TEST FAILED: first use of a fresh UTR should succeed, got %', v_result->>'status';
  end if;

  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status = 'cancelled';
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid;
  v_reference := v_result->>'reference';
  v_result := public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=' || v_reference || '&txnId=REUSEDTXN01');
  if v_result->>'status' = 'success' then
    raise exception 'TEST FAILED: reusing a UTR from another order must not auto-activate';
  end if;

  -- 3. the 3/day auto-activation cap holds (this user already has 2 successes above... wait, only 1).
  -- Drive two more successes to reach 3, then a 4th must be capped.
  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status in ('pending', 'cancelled');
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid; v_reference := v_result->>'reference';
  perform public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=' || v_reference || '&txnId=CAPTEST0002');

  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status = 'cancelled';
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid; v_reference := v_result->>'reference';
  perform public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=' || v_reference || '&txnId=CAPTEST0003');
  -- that's 3 autos total now (REUSEDTXN01, CAPTEST0002, CAPTEST0003); a 4th must be capped.

  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status = 'cancelled';
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid; v_reference := v_result->>'reference';
  v_result := public.report_payment_result(v_order_id, 'Status=SUCCESS&txnRef=' || v_reference || '&txnId=CAPTEST0004');
  if v_result->>'status' = 'success' then
    raise exception 'TEST FAILED: a 4th auto-activation within 24h must be capped to pending, got success';
  end if;
  if v_result->>'reason' <> 'daily_auto_activation_cap' then
    raise exception 'TEST FAILED: expected reason daily_auto_activation_cap, got %', v_result->>'reason';
  end if;

  -- 5. non-owner/non-admin can't call admin functions
  perform set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
  begin
    perform public.admin_set_upi('someone@upi', 'Someone');
    raise exception 'TEST FAILED: a non-admin should not be able to call admin_set_upi';
  exception when others then
    if sqlerrm <> 'not authorized' then raise; end if;
  end;

  raise notice 'upi_payments_test: tests 1, 2, 3, 5 passed';
end $$;

-- 4. revoke blocks the UTR forever: owner marks an order paid, then revokes it, then a second
-- order trying the same UTR must be rejected.
do $$
declare v_order_id uuid; v_reference text; v_utr text := 'REVOKETEST01'; v_result jsonb; v_plan_id bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  select id into v_plan_id from public.plans where code = 'coins_100';
  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status = 'pending';
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid;

  perform set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
  perform public.admin_mark_paid(v_order_id, v_utr);
  perform public.admin_revoke_payment(v_order_id, 'chargeback');

  if not exists (select 1 from public.blocked_txn_ids where utr = v_utr) then
    raise exception 'TEST FAILED: revoking an order should add its UTR to blocked_txn_ids';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
  update public.payment_orders set status = 'initiated', created_at = now() where user_id = '11111111-1111-1111-1111-111111111111' and status in ('revoked', 'cancelled') and id <> v_order_id;
  v_result := public.create_payment_order(v_plan_id);
  declare v_order_id2 uuid := (v_result->>'order_id')::uuid; v_reference2 text := v_result->>'reference';
  begin
    v_result := public.report_payment_result(v_order_id2, 'Status=SUCCESS&txnRef=' || v_reference2 || '&txnId=' || v_utr);
    if v_result->>'status' = 'success' then
      raise exception 'TEST FAILED: a blocked UTR must never be usable again';
    end if;
  end;

  raise notice 'upi_payments_test: test 4 passed';
end $$;

-- 6. the last owner can't be removed or demoted
do $$
begin
  begin
    delete from public.admins where user_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'TEST FAILED: deleting the last owner should have raised';
  exception when others then
    if sqlerrm <> 'cannot remove or demote the last owner' then raise; end if;
  end;

  begin
    update public.admins set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'TEST FAILED: demoting the last owner should have raised';
  exception when others then
    if sqlerrm <> 'cannot remove or demote the last owner' then raise; end if;
  end;

  raise notice 'upi_payments_test: test 6 passed';
end $$;

-- 7. price edits don't change open orders (the order snapshots amount_paise at creation time)
do $$
declare v_plan_id bigint; v_original_price bigint; v_order_id uuid; v_result jsonb; v_snapshot_amount bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
  select id, price_paise into v_plan_id, v_original_price from public.plans where code = 'coins_550';

  perform set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
  v_result := public.create_payment_order(v_plan_id);
  v_order_id := (v_result->>'order_id')::uuid;
  select amount_paise into v_snapshot_amount from public.payment_orders where id = v_order_id;

  perform set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
  perform public.admin_update_plan(v_plan_id, '550 Coins', v_original_price * 2, 0, array['x'], null, true, 2, false);

  if (select amount_paise from public.payment_orders where id = v_order_id) <> v_snapshot_amount then
    raise exception 'TEST FAILED: an open order''s amount must not change when the plan price changes';
  end if;

  raise notice 'upi_payments_test: test 7 passed';
end $$;

do $$ begin raise notice 'upi_payments_test: ALL TESTS PASSED'; end $$;

rollback;
