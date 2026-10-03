import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const supplied = req.headers.get('authorization') || '';
  const expected = 'Bearer ' + (secret || '');
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Revalidate all main public routes on the website
    revalidatePath('/', 'layout');
    revalidatePath('/', 'page');
    revalidatePath('/activities', 'page');
    revalidatePath('/about', 'page');
    revalidatePath('/location', 'page');
    revalidatePath('/contact', 'page');
    revalidatePath('/book', 'page');

    return NextResponse.json({
      success: true,
      message: 'Website cache revalidated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Failed to revalidate website paths:', error);
    return NextResponse.json(
      { success: false, error: 'Revalidation failed' },
      { status: 500 }
    );
  }
}
