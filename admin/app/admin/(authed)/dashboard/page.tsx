import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_dashboard');

  if (error || !data) {
    return <p className="text-red-700">Could not load dashboard: {error?.message}</p>;
  }

  const cards = [
    { label: 'Revenue today', value: rupees(data.revenue_today_paise) },
    { label: 'Revenue (7 days)', value: rupees(data.revenue_7d_paise) },
    { label: 'Revenue (30 days)', value: rupees(data.revenue_30d_paise) },
    { label: 'Active subscribers', value: data.active_subscribers },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Dashboard</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-orange-200 bg-white p-4">
            <p className="text-xs text-stone-500">{c.label}</p>
            <p className="text-2xl font-semibold text-stone-800">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <Link href="/admin/payments?filter=pending" className="rounded-lg border border-orange-200 bg-white p-4 hover:bg-orange-50">
          <p className="text-xs text-stone-500">Pending payments</p>
          <p className="text-2xl font-semibold text-amber-700">{data.pending_count}</p>
        </Link>
        <div className="rounded-lg border border-orange-200 bg-white p-4">
          <p className="text-xs text-stone-500">Successful</p>
          <p className="text-2xl font-semibold text-green-700">{data.success_count}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-white p-4">
          <p className="text-xs text-stone-500">Failed</p>
          <p className="text-2xl font-semibold text-red-700">{data.failed_count}</p>
        </div>
      </div>
    </div>
  );
}
