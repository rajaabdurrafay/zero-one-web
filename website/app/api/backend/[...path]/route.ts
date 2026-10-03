import { NextRequest, NextResponse } from 'next/server';
const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const COOKIE = 'zeroone-customer-session';
export const runtime = 'nodejs';
async function relay(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const mutation = !['GET', 'HEAD'].includes(request.method);
  if (mutation && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const { path } = await context.params;
  if (path[0] !== 'api' || path.some(segment => segment === '..' || segment === '.' || segment.includes('/') || segment.includes('\\'))) return NextResponse.json({ error: 'Invalid API path.' }, { status: 400 });
  try {
    const url = new URL('/' + path.map(encodeURIComponent).join('/'), API); url.search = request.nextUrl.search;
    const token = request.cookies.get(COOKIE)?.value;
    const headers = new Headers({ 'Content-Type': request.headers.get('content-type') || 'application/json' });
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const access = request.headers.get('x-booking-token'); if (access) headers.set('x-booking-token', access);
    const body = mutation ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 10 * 1024 * 1024) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const upstream = await fetch(url, { method: request.method, headers, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (upstream.ok && request.method === 'POST' && ['api/auth/login', 'api/auth/signup'].includes(path.join('/'))) {
      const data = await upstream.json();
      const response = NextResponse.json({ ...data, token: 'cookie-session' }, { status: upstream.status });
      response.cookies.set(COOKIE, data.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', ...(upstream.headers.get('retry-after') ? { 'Retry-After': upstream.headers.get('retry-after')! } : {}) } });
  } catch { return NextResponse.json({ error: 'Backend unavailable.' }, { status: 502 }); }
}
export { relay as GET, relay as POST, relay as PUT, relay as PATCH, relay as DELETE, relay as HEAD };
