import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const token=request.cookies.get('zeroone-customer-session')?.value;
  if(token){
    try{
      const upstream=await fetch((process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if(!upstream.ok && upstream.status!==401)return NextResponse.json({error:'Could not revoke session. Please retry.'},{status:502});
    }catch{return NextResponse.json({error:'Could not revoke session. Please retry.'},{status:502})}
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete('zeroone-customer-session');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
