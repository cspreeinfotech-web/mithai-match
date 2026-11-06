import { createClient } from '@/lib/supabase/server';

type UserRow = { user_id: string; email: string; plan_code: string | null; ends_at: string | null; payment_count: number };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search = '' } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_users', { p_search: search || null, p_limit: 100, p_offset: 0 });

  if (error) return <p className="text-red-700">{error.message}</p>;
  const users = (data ?? []) as UserRow[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Users</h1>
      <form className="mb-4">
        <input name="search" defaultValue={search} placeholder="search by email" className="rounded border border-stone-300 p-2 text-sm" />
      </form>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left text-stone-500">
            <th className="py-2">Email</th>
            <th>Plan</th>
            <th>Expires</th>
            <th>Payments</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id} className="border-b border-stone-100">
              <td className="py-2">{u.email}</td>
              <td>{u.plan_code ?? '-'}</td>
              <td>{u.ends_at ? new Date(u.ends_at).toLocaleDateString() : '-'}</td>
              <td>{u.payment_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
