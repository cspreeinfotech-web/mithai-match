import { createClient } from '@/lib/supabase/server';
import { createPlan, updatePlan } from './actions';

type Plan = {
  id: number; code: string; name: string; price_paise: number; duration_days: number;
  active: boolean; sort: number; perks: string[]; badge: string | null; free_eligible: boolean;
};

export default async function PlansPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_plans');

  if (error) return <p className="text-red-700">{error.message}</p>;
  const plans = (data ?? []) as Plan[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-orange-700">Plans</h1>

      <div className="mb-8 space-y-4">
        {plans.map((plan) => (
          <form key={plan.id} action={updatePlan.bind(null, plan.id)} className="grid grid-cols-7 items-end gap-2 rounded-lg border border-orange-200 bg-white p-4">
            <div className="col-span-2">
              <label className="block text-xs text-stone-500">Name ({plan.code})</label>
              <input name="name" defaultValue={plan.name} required className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Price ₹</label>
              <input name="price_rupees" type="number" step="0.01" defaultValue={plan.price_paise / 100} required className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Days</label>
              <input name="duration_days" type="number" defaultValue={plan.duration_days} required className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-stone-500">Perks (comma-separated)</label>
              <input name="perks" defaultValue={plan.perks.join(', ')} className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Badge</label>
              <input name="badge" defaultValue={plan.badge ?? ''} className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500">Sort</label>
              <input name="sort" type="number" defaultValue={plan.sort} className="w-full rounded border border-stone-300 p-1 text-sm" />
            </div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="active" defaultChecked={plan.active} /> Active
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="free_eligible" defaultChecked={plan.free_eligible} /> Free-eligible
            </label>
            <button className="rounded bg-orange-600 px-3 py-1 text-sm text-white">Save</button>
          </form>
        ))}
      </div>

      <h2 className="mb-3 font-medium">New plan</h2>
      <form action={createPlan} className="grid grid-cols-7 items-end gap-2 rounded-lg border border-orange-200 bg-white p-4">
        <div>
          <label className="block text-xs text-stone-500">Code</label>
          <input name="code" required className="w-full rounded border border-stone-300 p-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-stone-500">Name</label>
          <input name="name" required className="w-full rounded border border-stone-300 p-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-stone-500">Price ₹</label>
          <input name="price_rupees" type="number" step="0.01" required className="w-full rounded border border-stone-300 p-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-stone-500">Days</label>
          <input name="duration_days" type="number" required className="w-full rounded border border-stone-300 p-1 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-stone-500">Perks</label>
          <input name="perks" className="w-full rounded border border-stone-300 p-1 text-sm" />
        </div>
        <button className="rounded bg-orange-600 px-3 py-1 text-sm text-white">Create</button>
      </form>
    </div>
  );
}
