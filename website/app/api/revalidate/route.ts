import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
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
      { success: false, error: error.message || 'Revalidation failed' },
      { status: 500 }
    );
  }
}
