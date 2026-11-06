import { createClient } from '@/lib/supabase/server';

type HistoryRow = {
  id: number; table: string; row_id: string | null; changed_by_email: string | null;
  old: Record<string, unknown> | null; new: Record<string, unknown> | null; changed_at: string;
};

export default async function PaymentsHistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_settings_history', { p_limit: 100 });

  if (error) return <p className="text-red-700">{error.message}</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Change history</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left text-stone-500">
            <th className="py-2">Table</th>
            <th>Row</th>
            <th>Changed by</th>
            <th>Old → New</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {((data ?? []) as HistoryRow[]).map((row) => (
            <tr key={row.id} className="border-b border-stone-100 align-top">
              <td className="py-2">{row.table}</td>
              <td>{row.row_id}</td>
              <td>{row.changed_by_email ?? 'system'}</td>
              <td className="max-w-md font-mono text-xs">
                {JSON.stringify(row.old)} → {JSON.stringify(row.new)}
              </td>
              <td className="text-xs">{new Date(row.changed_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
