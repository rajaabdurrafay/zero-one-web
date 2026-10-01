import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_TOKEN, TOKEN_COOKIE, ROLE_COOKIE, USER_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN)?.value;

  // Attempt to hit the backend logout endpoint to close the attendance log
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth/admin/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.error('Failed to notify backend of logout:', e);
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  response.cookies.delete(SESSION_TOKEN);
  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete(ROLE_COOKIE);
  response.cookies.delete(USER_COOKIE);

  return response;
}
