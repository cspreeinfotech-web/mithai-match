'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function addAdmin(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_add_admin', {
    p_email: formData.get('email'),
    p_role: formData.get('role'),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/admins');
}

export async function removeAdmin(userId: string, _formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_remove_admin', { p_user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/admins');
}
