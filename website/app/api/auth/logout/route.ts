import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.delete('zeroone-customer-session');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
