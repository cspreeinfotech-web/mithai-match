// Required for Google Play's data-deletion policy: deletes everything the app stored for the
// calling user (their own rows, verified by their JWT) and the auth user itself. Call this
// from Settings -> Delete my data, with the user's own session JWT in the Authorization header.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing Authorization header' }), { status: 401 });
  }

  // Identify the caller from their own JWT (anon key client — RLS-scoped, just for auth.getUser()).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'invalid session' }), { status: 401 });
  }
  const userId = userData.user.id;

  // Service-role client to actually delete rows + the auth user (bypasses RLS on purpose —
  // this endpoint IS the authorized path for a user to erase their own data).
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const tablesByUserId = ['purchases', 'shop_upgrades', 'inventory', 'level_progress'];
  for (const table of tablesByUserId) {
    await adminClient.from(table).delete().eq('user_id', userId);
  }
  // profiles' own primary key is `id`, not `user_id`.
  await adminClient.from('profiles').delete().eq('id', userId);

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return new Response(JSON.stringify({ error: authDeleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: true }), { headers: { 'Content-Type': 'application/json' } });
});
