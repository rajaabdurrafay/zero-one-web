import { NextRequest, NextResponse } from 'next/server';
import { SESSION_TOKEN, AdminRole } from '@/lib/auth';

// Route permissions mapping
const SUPER_ADMIN_ONLY_PREFIXES = ['/staff', '/appearance'];
const MANAGEMENT_ONLY_PREFIXES = ['/analytics', '/pricing', '/offers', '/messages'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, API routes, Next internal assets, and static files
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get(SESSION_TOKEN);
  let role: AdminRole;
  try {
    const api = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(api + '/api/auth/admin/me', { headers: { Authorization: 'Bearer ' + (session?.value || '') }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return NextResponse.redirect(new URL('/login', request.url));
    role = (await response.json()).user.role;
  } catch { return NextResponse.redirect(new URL('/login', request.url)); }

  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based route guarding
  if (role === 'RECEPTIONIST') {
    // Receptionist cannot access Management or Super Admin only pages
    const isSuperAdminOnly = SUPER_ADMIN_ONLY_PREFIXES.some(prefix => pathname.startsWith(prefix));
    const isManagementOnly = MANAGEMENT_ONLY_PREFIXES.some(prefix => pathname.startsWith(prefix));

    if (isSuperAdminOnly || isManagementOnly) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else if (role === 'MANAGER') {
    // Manager cannot access Super Admin only pages
    const isSuperAdminOnly = SUPER_ADMIN_ONLY_PREFIXES.some(prefix => pathname.startsWith(prefix));

    if (isSuperAdminOnly) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
