import { login } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <form action={login} className="w-full max-w-sm rounded-lg border border-orange-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-orange-700">Mithai Match Admin</h1>
        {error === 'not_authorized' && (
          <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">That account isn&apos;t an admin.</p>
        )}
        {error === 'bad_credentials' && (
          <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">Wrong email or password.</p>
        )}
        <label className="mb-1 block text-sm text-stone-600">Email</label>
        <input name="email" type="email" required className="mb-4 w-full rounded border border-stone-300 p-2" />
        <label className="mb-1 block text-sm text-stone-600">Password</label>
        <input name="password" type="password" required className="mb-6 w-full rounded border border-stone-300 p-2" />
        <button type="submit" className="w-full rounded bg-orange-600 p-2 font-medium text-white hover:bg-orange-700">
          Sign in
        </button>
        <p className="mt-4 text-center text-xs text-stone-400">
          Need help? <a href="mailto:help.mithaimatch@gmail.com" className="underline">help.mithaimatch@gmail.com</a>
        </p>
      </form>
    </div>
  );
}
