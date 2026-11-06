import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '../login/actions';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: status } = await supabase.rpc('am_i_admin');
  const isOwner = !!status?.is_owner;

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/payments', label: 'Payments' },
    { href: '/admin/plans', label: 'Plans' },
    { href: '/admin/users', label: 'Users' },
    ...(isOwner ? [{ href: '/admin/admins', label: 'Admins' }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <nav className="w-48 border-r border-orange-200 bg-white p-4">
        <h2 className="mb-6 text-lg font-semibold text-orange-700">Mithai Match</h2>
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block rounded px-3 py-2 text-sm text-stone-700 hover:bg-orange-50">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={logout} className="mt-8">
          <button type="submit" className="text-sm text-stone-400 hover:text-stone-600">
            Sign out
          </button>
        </form>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
