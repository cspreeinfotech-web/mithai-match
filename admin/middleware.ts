import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (!data.user && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (data.user && !isLoginPage) {
    const { data: status } = await supabase.rpc('am_i_admin');
    if (!status?.is_admin) {
      return NextResponse.redirect(new URL('/admin/login?error=not_authorized', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
