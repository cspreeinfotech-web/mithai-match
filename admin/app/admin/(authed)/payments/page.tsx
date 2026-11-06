import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ConfirmButton } from '../ConfirmButton';
import { markPaid, revokePayment, setUpi, clearUpi, setPaymentsEnabled, setActivationMode, setFreeMode } from './actions';

type Order = {
  id: string; user_email: string; plan_name: string; amount_paise: number;
  reference: string; utr: string | null; status: string; reason: string | null;
  activated_by: string | null; created_at: string;
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string; search?: string }> }) {
  const { filter = 'all', search = '' } = await searchParams;
  const supabase = await createClient();

  const [{ data: settings }, { data: orders, error: ordersError }, { data: appMode }] = await Promise.all([
    supabase.rpc('admin_payment_settings'),
    supabase.rpc('admin_payments', { p_filter: filter, p_search: search || null, p_limit: 100, p_offset: 0 }),
    supabase.from('app_mode').select('free_mode').eq('id', 1).maybeSingle(),
  ]);

  const isOwner = settings !== null; // admin_payment_settings only returns a row for the owner

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Payments</h1>

      {isOwner && (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-orange-200 bg-white p-5">
            <h2 className="mb-3 font-medium">UPI settings</h2>
            {settings.upi_id ? (
              <p className="mb-3 text-sm text-stone-600">
                <span className="font-mono">{settings.upi_id}</span> — {settings.payee_name}
              </p>
            ) : (
              <p className="mb-3 text-sm text-stone-500">No UPI ID set — payments are unavailable in the app.</p>
            )}
            <form action={setUpi} className="mb-3 flex gap-2">
              <input name="upi_id" placeholder="yourid@bank" defaultValue={settings.upi_id ?? ''} className="flex-1 rounded border border-stone-300 p-2 text-sm" />
              <input name="payee_name" placeholder="Payee name" defaultValue={settings.payee_name ?? ''} className="flex-1 rounded border border-stone-300 p-2 text-sm" />
              <button className="rounded bg-orange-600 px-3 py-2 text-sm text-white">Change UPI</button>
            </form>
            <form action={clearUpi} className="mb-4">
              <ConfirmButton message="Clear the UPI ID? This turns payments off app-wide." className="text-sm text-red-700 underline">
                Clear UPI
              </ConfirmButton>
            </form>

            <form action={setPaymentsEnabled} className="mb-2 flex items-center gap-2">
              <input type="hidden" name="enabled" value={settings.enabled ? 'false' : 'true'} />
              <span className="text-sm">Payments enabled: {settings.enabled ? 'ON' : 'OFF'}</span>
              <button className="rounded border border-stone-300 px-2 py-1 text-xs">Toggle</button>
            </form>

            <form action={setActivationMode} className="flex items-center gap-2">
              <span className="text-sm">Activation:</span>
              {(['instant', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  type="submit"
                  name="mode"
                  value={m}
                  className={`rounded px-2 py-1 text-xs ${settings.activation_mode === m ? 'bg-orange-600 text-white' : 'border border-stone-300'}`}
                >
                  {m}
                </button>
              ))}
            </form>
          </div>

          <div className="rounded-lg border border-orange-200 bg-white p-5">
            <h2 className="mb-3 font-medium">Free mode</h2>
            <p className="mb-3 text-sm text-stone-600">When on, every plan is free for every user.</p>
            <form action={setFreeMode}>
              <input type="hidden" name="enabled" value={appMode?.free_mode ? 'false' : 'true'} />
              <ConfirmButton
                message={
                  appMode?.free_mode
                    ? 'Turn free mode off? Users will need to pay again.'
                    : 'Make every plan free for every user right now?'
                }
                className={`rounded px-3 py-2 text-sm text-white ${appMode?.free_mode ? 'bg-red-600' : 'bg-green-600'}`}
              >
                {appMode?.free_mode ? 'Turn off free mode' : 'Turn on free mode'}
              </ConfirmButton>
            </form>
            <Link href="/admin/payments/history" className="mt-4 block text-sm text-orange-700 underline">
              Change history
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(['all', 'pending', 'success', 'failed', 'revoked'] as const).map((f) => (
          <Link
            key={f}
            href={`/admin/payments?filter=${f}${search ? `&search=${search}` : ''}`}
            className={`rounded px-3 py-1 text-sm ${filter === f ? 'bg-orange-600 text-white' : 'border border-stone-300'}`}
          >
            {f}
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="filter" value={filter} />
          <input name="search" defaultValue={search} placeholder="reference, UTR or email" className="rounded border border-stone-300 p-1 text-sm" />
        </form>
      </div>

      {ordersError && <p className="text-red-700">Could not load payments: {ordersError.message}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left text-stone-500">
            <th className="py-2">User</th>
            <th>Plan</th>
            <th>Amount</th>
            <th>Reference</th>
            <th>UTR</th>
            <th>Status</th>
            <th>Channel</th>
            <th>Time</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {((orders ?? []) as Order[]).map((o) => (
            <tr key={o.id} className="border-b border-stone-100">
              <td className="py-2">{o.user_email}</td>
              <td>{o.plan_name}</td>
              <td>₹{(o.amount_paise / 100).toFixed(0)}</td>
              <td className="font-mono text-xs">{o.reference}</td>
              <td className="font-mono text-xs">{o.utr ?? '-'}</td>
              <td>
                {o.status}
                {o.reason ? <span className="text-stone-400"> ({o.reason})</span> : null}
              </td>
              <td>{o.activated_by ?? '-'}</td>
              <td className="text-xs">{new Date(o.created_at).toLocaleString()}</td>
              <td>
                {(o.status === 'initiated' || o.status === 'pending') && (
                  <form action={markPaid.bind(null, o.id)} className="mb-1 flex gap-1">
                    <input name="utr" defaultValue={o.utr ?? ''} placeholder="UTR" required className="w-24 rounded border border-stone-300 p-1 text-xs" />
                    <ConfirmButton message="Mark this order paid with this UTR?" className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                      Mark paid
                    </ConfirmButton>
                  </form>
                )}
                {o.status !== 'revoked' && (
                  <form action={revokePayment.bind(null, o.id)} className="flex gap-1">
                    <input name="reason" placeholder="reason" required className="w-20 rounded border border-stone-300 p-1 text-xs" />
                    <ConfirmButton message="Revoke this payment? This blocks its UTR forever." className="rounded bg-red-600 px-2 py-1 text-xs text-white">
                      Revoke
                    </ConfirmButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
