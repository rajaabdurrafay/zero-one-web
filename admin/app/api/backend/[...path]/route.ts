import { NextRequest, NextResponse } from 'next/server';
import { SESSION_TOKEN } from '@/lib/auth';
const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const runtime = 'nodejs';
async function relay(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = request.cookies.get(SESSION_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const mutation = !['GET', 'HEAD'].includes(request.method);
  if (mutation && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const { path } = await context.params;
  if (path[0] !== 'api' || path.some(segment => segment === '..' || segment === '.' || segment.includes('/') || segment.includes('\\'))) return NextResponse.json({ error: 'Invalid API path.' }, { status: 400 });
  try {
    const url = new URL('/' + path.map(encodeURIComponent).join('/'), API); url.search = request.nextUrl.search;
    const body = mutation ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 10 * 1024 * 1024) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const response = await fetch(url, { method: request.method, headers: { Authorization: 'Bearer ' + token,'User-Agent':request.headers.get('user-agent') || '',...(process.env.TRUST_FRONTEND_PROXY_HEADERS==='true' && request.headers.get('x-forwarded-for') ? {'X-Forwarded-For':request.headers.get('x-forwarded-for')!}:{}), 'Content-Type': request.headers.get('content-type') || 'application/json' }, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'retry-after','x-total-count','x-page','x-page-limit']) { const value = response.headers.get(name); if (value) headers.set(name, value); }
    return new NextResponse(response.body, { status: response.status, headers });
  } catch { return NextResponse.json({ error: 'Backend unavailable.' }, { status: 502 }); }
}
export { relay as GET, relay as POST, relay as PUT, relay as PATCH, relay as DELETE, relay as HEAD };
