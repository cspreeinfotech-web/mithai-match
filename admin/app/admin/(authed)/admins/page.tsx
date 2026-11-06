import { createClient } from '@/lib/supabase/server';
import { ConfirmButton } from '../ConfirmButton';
import { addAdmin, removeAdmin } from './actions';

type AdminRow = { user_id: string; email: string; role: 'owner' | 'admin'; created_at: string };

export default async function AdminsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_admins');

  // The RPC itself raises 'not authorized' for a non-owner, but middleware already lets
  // any admin through to /admin/* — this page is the owner-only exception.
  if (error) return <p className="text-red-700">Owner access only: {error.message}</p>;
  const admins = (data ?? []) as AdminRow[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Admins</h1>
      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left text-stone-500">
            <th className="py-2">Email</th>
            <th>Role</th>
            <th>Since</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.user_id} className="border-b border-stone-100">
              <td className="py-2">{a.email}</td>
              <td>{a.role}</td>
              <td>{new Date(a.created_at).toLocaleDateString()}</td>
              <td>
                <form action={removeAdmin.bind(null, a.user_id)}>
                  <ConfirmButton message={`Remove ${a.email} as admin?`} className="text-xs text-red-700 underline">
                    Remove
                  </ConfirmButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-3 font-medium">Add an admin</h2>
      <p className="mb-3 text-sm text-stone-500">The person must have already signed into the app at least once.</p>
      <form action={addAdmin} className="flex gap-2">
        <input name="email" type="email" required placeholder="email" className="rounded border border-stone-300 p-2 text-sm" />
        <select name="role" className="rounded border border-stone-300 p-2 text-sm">
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <button className="rounded bg-orange-600 px-3 py-2 text-sm text-white">Add</button>
      </form>
    </div>
  );
}
