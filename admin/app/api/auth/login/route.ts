import { NextRequest, NextResponse } from 'next/server';
import { SESSION_TOKEN, TOKEN_COOKIE, ROLE_COOKIE, USER_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const backendRes = await fetch(`${API_BASE}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      token,
      isNewDevice,
      deviceInfo,
      whatsappAlertUrl,
    });

    const cookieOptions = {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    // Store HttpOnly session token for middleware
    response.cookies.set(SESSION_TOKEN, token, {
      ...cookieOptions,
      httpOnly: true,
    });

    // Store readable token for browser apiFetch to include in Authorization header
    response.cookies.set(TOKEN_COOKIE, token, {
      ...cookieOptions,
      httpOnly: false,
    });

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
