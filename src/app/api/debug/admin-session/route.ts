import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';

export async function GET() {
  try {
    console.log('[AdminSession] Testing admin session...');
    
    const session = await requireAuthSession();
    
    console.log('[AdminSession] Session found:', session);
    
    return NextResponse.json({
      success: true,
      session: {
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userRole: session?.user?.role,
        userName: session?.user?.name,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminSession] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
