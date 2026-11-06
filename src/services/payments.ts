import { getSupabase } from './supabaseClient';
import { Upi } from './upiPlugin';
import { APP_NAME } from '../config/app.config';
import { grantLocally } from './billing/verifyPurchase';
import { loadJson, saveJson } from './storage';

// A UPI order's coins are credited to the local wallet (the game's economy lives in
// localStorage, not server-side) exactly once per order id — tracked here so re-viewing
// Payment History, or a 'pending' order later turning into 'success' on manual review,
// never double-grants.
const GRANTED_KEY = 'upiGrantedOrderIds';

/** Grants an order's coins locally if (and only if) this order id hasn't been granted before. */
export function grantOrderOnce(order: PaymentOrder): void {
  if (order.status !== 'success' || order.coins <= 0) return;
  const granted = loadJson<string[]>(GRANTED_KEY, []);
  if (granted.includes(order.id)) return;
  grantLocally(order.coins, 0);
  saveJson(GRANTED_KEY, [...granted, order.id]);
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price_paise: number;
  duration_days: number;
  coins: number;
  perks: string[];
  badge: string | null;
  sort: number;
  pay_mode: 'upi' | 'free' | 'unavailable';
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  plan_code: string;
  plan_name: string;
  duration_days: number;
  coins: number;
  amount_paise: number;
  reference: string;
  status: 'initiated' | 'pending' | 'success' | 'failed' | 'cancelled' | 'revoked';
  utr: string | null;
  reason: string | null;
  activated_by: 'auto' | 'owner' | 'webhook' | null;
  paid_at: string | null;
  created_at: string;
}

export type PayResult =
  | { outcome: 'success'; order: PaymentOrder }
  | { outcome: 'pending'; order: PaymentOrder }
  | { outcome: 'failed'; order: PaymentOrder }
  | { outcome: 'no_upi_app' }
  | { outcome: 'cancelled' } // user backed out before paying
  | { outcome: 'error'; message: string };

export async function plansForMe(): Promise<Plan[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('plans_for_me_v2');
  if (error) throw error;
  return data as Plan[];
}

export async function myPaymentOrders(limit = 20): Promise<PaymentOrder[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_payment_orders', { p_limit: limit });
  if (error) throw error;
  return data as PaymentOrder[];
}

export async function claimFreePlan(planId: number): Promise<PaymentOrder> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cloud sync is not set up yet.');
  const { data, error } = await supabase.rpc('claim_free_plan', { p_plan_id: planId });
  if (error) throw error;
  return data as PaymentOrder;
}

// Buys a plan: creates the order, opens the UPI app, and reports whatever it returns.
// Never sends an amount of its own — the amount shown in the UPI app comes straight from
// the server's order, built in create_payment_order().
export async function buyPlan(planId: number): Promise<PayResult> {
  const supabase = getSupabase();
  if (!supabase) return { outcome: 'error', message: 'Cloud sync is not set up yet.' };

  const { data: orderData, error: orderError } = await supabase.rpc('create_payment_order', { p_plan_id: planId });
  if (orderError) return { outcome: 'error', message: orderError.message };

  const { order_id, reference, amount, upi_id, payee_name } = orderData as {
    order_id: string; reference: string; amount: string; upi_id: string; payee_name: string;
  };

  const uri =
    `upi://pay?pa=${encodeURIComponent(upi_id)}&pn=${encodeURIComponent(payee_name)}` +
    `&tr=${encodeURIComponent(reference)}&am=${encodeURIComponent(amount)}&cu=INR` +
    `&tn=${encodeURIComponent(`${APP_NAME} ${reference}`)}`;

  let rawResponse = '';
  try {
    const result = await Upi.startUpi({ uri });
    rawResponse = result.response;
  } catch (err) {
    const code = (err as { message?: string })?.message;
    if (code === 'NO_UPI_APP') return { outcome: 'no_upi_app' };
    if (code === 'BUSY') return { outcome: 'error', message: 'A payment is already open.' };
    return { outcome: 'error', message: code ?? 'Could not open a UPI app.' };
  }

  const { data: reportData, error: reportError } = await supabase.rpc('report_payment_result', {
    p_order_id: order_id,
    p_raw_response: rawResponse,
  });
  if (reportError) return { outcome: 'error', message: reportError.message };

  const order = reportData as PaymentOrder;
  if (order.status === 'success') return { outcome: 'success', order };
  if (order.status === 'failed') return { outcome: 'failed', order };
  if (order.status === 'pending') return { outcome: 'pending', order };
  return { outcome: 'cancelled' }; // still 'initiated' — the UPI app returned nothing (back button)
}
