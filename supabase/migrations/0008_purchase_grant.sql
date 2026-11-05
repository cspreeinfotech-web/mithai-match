-- Called only by the verify-purchase Edge Function with the service-role key (never exposed
-- to the client), after it has independently verified the purchase with the Google Play
-- Developer API. Idempotent: replaying the same purchase_token credits nothing a second time
-- because of the unique constraint + the `if not found` check below.
create or replace function public.apply_purchase(
  p_user_id uuid,
  p_product_id text,
  p_purchase_token text,
  p_order_id text,
  p_price_micros bigint,
  p_currency text,
  p_coins integer,
  p_lives integer
)
returns public.purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase public.purchases;
begin
  insert into public.purchases (user_id, product_id, purchase_token, order_id, status, price_micros, currency)
    values (p_user_id, p_product_id, p_purchase_token, p_order_id, 'granted', p_price_micros, p_currency)
  on conflict (purchase_token) do nothing
  returning * into v_purchase;

  if not found then
    -- Token already recorded (replay/retry) — return the existing row, grant nothing again.
    select * into v_purchase from public.purchases where purchase_token = p_purchase_token;
    return v_purchase;
  end if;

  if p_coins > 0 then
    update public.profiles set coins = coins + p_coins where id = p_user_id;
  end if;
  if p_lives > 0 then
    update public.profiles set lives = least(5, lives + p_lives), lives_updated_at = now() where id = p_user_id;
  end if;

  update public.purchases
    set granted_json = jsonb_build_object('coins', p_coins, 'lives', p_lives)
    where id = v_purchase.id
    returning * into v_purchase;

  return v_purchase;
end;
$$;

-- Leaderboard: display name + total stars only, no other personal data.
create or replace view public.leaderboard as
  select coalesce(display_name, 'Player') as display_name, total_stars
  from public.profiles
  order by total_stars desc
  limit 100;
