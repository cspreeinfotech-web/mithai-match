'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Every write below is a plain RPC call — the DB enforces who's allowed to do what and
// what counts as valid, so this file is just plumbing, not a second copy of the rules.

async function callOrThrow(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/payments');
}

// Bound as action={markPaid.bind(null, order.id)} on a <form>, so the form only needs a `utr` field.
export async function markPaid(orderId: string, formData: FormData) {
  const utr = (formData.get('utr') as string).trim().toUpperCase();
  await callOrThrow('admin_mark_paid', { p_order_id: orderId, p_utr: utr });
}

export async function revokePayment(orderId: string, formData: FormData) {
  const reason = formData.get('reason') as string;
  await callOrThrow('admin_revoke_payment', { p_order_id: orderId, p_reason: reason });
}

export async function setUpi(formData: FormData) {
  const upiId = (formData.get('upi_id') as string).trim();
  const payeeName = (formData.get('payee_name') as string).trim();
  await callOrThrow('admin_set_upi', { p_upi_id: upiId, p_payee_name: payeeName });
}

export async function clearUpi() {
  await callOrThrow('admin_clear_upi', {});
}

export async function setPaymentsEnabled(formData: FormData) {
  await callOrThrow('admin_set_payments_enabled', { p_enabled: formData.get('enabled') === 'true' });
}

export async function setActivationMode(formData: FormData) {
  await callOrThrow('admin_set_activation_mode', { p_mode: formData.get('mode') });
}

export async function setFreeMode(formData: FormData) {
  await callOrThrow('admin_set_free_mode', { p_enabled: formData.get('enabled') === 'true' });
}
