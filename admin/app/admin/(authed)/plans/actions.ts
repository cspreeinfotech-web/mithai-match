'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function parsePerks(raw: string): string[] {
  return raw.split(',').map((p) => p.trim()).filter(Boolean);
}

export async function createPlan(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_create_plan', {
    p_code: formData.get('code'),
    p_name: formData.get('name'),
    p_price_paise: Math.round(Number(formData.get('price_rupees')) * 100),
    p_duration_days: Number(formData.get('duration_days')),
    p_perks: parsePerks(formData.get('perks') as string),
    p_badge: (formData.get('badge') as string) || null,
    p_sort: Number(formData.get('sort') || 0),
    p_free_eligible: formData.get('free_eligible') === 'on',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/plans');
}

export async function updatePlan(planId: number, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_plan', {
    p_id: planId,
    p_name: formData.get('name'),
    p_price_paise: Math.round(Number(formData.get('price_rupees')) * 100),
    p_duration_days: Number(formData.get('duration_days')),
    p_perks: parsePerks(formData.get('perks') as string),
    p_badge: (formData.get('badge') as string) || null,
    p_active: formData.get('active') === 'on',
    p_sort: Number(formData.get('sort') || 0),
    p_free_eligible: formData.get('free_eligible') === 'on',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/plans');
}
