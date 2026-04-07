import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/auth';
import { SignJWT } from 'jose';

// Use the same JWT secret as mobile app for Socket.IO compatibility
const JWT_SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
);

export async function POST() {
  try {
    const session = await requireAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create JWT token for socket authentication
    const token = await new SignJWT({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role || 'ADMIN',
      name: session.user.name
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    console.log('[ChatToken] Generated token for admin user:', session.user.email);

    return NextResponse.json({ token });
  } catch (error) {
    console.error('[ChatToken] Error generating token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
