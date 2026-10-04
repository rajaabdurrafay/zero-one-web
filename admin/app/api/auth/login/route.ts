import { NextRequest, NextResponse } from 'next/server';
import { hasValidOrigin } from '@/lib/requestOrigin';
import { SESSION_TOKEN, TOKEN_COOKIE, ROLE_COOKIE, USER_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    if (!hasValidOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const backendRes = await fetch(`${API_BASE}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json','User-Agent':request.headers.get('user-agent') || '',...(process.env.TRUST_FRONTEND_PROXY_HEADERS==='true' && request.headers.get('x-forwarded-for') ? {'X-Forwarded-For':request.headers.get('x-forwarded-for')!}:{}) },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ username, password }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.error || 'Authentication failed' },
        { status: backendRes.status || 401 }
      );
    }

    const { token, user, isNewDevice, deviceInfo, whatsappAlertUrl } = data;

    const response = NextResponse.json({
      success: true,
      message: 'Signed in successfully',
      user,
      isNewDevice,
      deviceInfo,
      whatsappAlertUrl,
    });

    const cookieOptions = {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8, // matches backend token lifetime
    };

    // Store HttpOnly session token for middleware
    response.cookies.set(SESSION_TOKEN, token, {
      ...cookieOptions,
      httpOnly: true,
    });

    response.cookies.delete(TOKEN_COOKIE);

    // Store role and user details in cookies readable by client components and middleware
    response.cookies.set(ROLE_COOKIE, user.role, {
      ...cookieOptions,
      httpOnly: false,
    });

    response.cookies.set(USER_COOKIE, JSON.stringify(user), {
      ...cookieOptions,
      httpOnly: false,
    });

    return response;
  } catch (err: any) {
    console.error('Login error in admin route handler:', err);
    return NextResponse.json(
      { error: 'Unable to connect to authentication server. Please ensure backend is running.' },
      { status: 500 }
    );
  }
}
