import { NextRequest, NextResponse } from 'next/server';
import { SESSION_TOKEN, ROLE_COOKIE, AdminRole } from '@/lib/auth';

// Route permissions mapping
const SUPER_ADMIN_ONLY_PREFIXES = ['/staff', '/appearance'];
const MANAGEMENT_ONLY_PREFIXES = ['/analytics', '/pricing', '/offers', '/messages'];

export function middleware(request: NextRequest) {
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
  const role = request.cookies.get(ROLE_COOKIE)?.value as AdminRole | undefined;

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
