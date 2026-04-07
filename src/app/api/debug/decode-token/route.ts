import { NextRequest, NextResponse } from 'next/server';

// Copy of server's decodeToken function for testing
function decodeToken(token: string) {
  try {
    // Split the JWT and decode the payload (middle part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch (error) {
    console.error('[DecodeToken] Error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;
    
    console.log('[DecodeToken] Testing token decode...');
    console.log('[DecodeToken] Token length:', token?.length);
    console.log('[DecodeToken] Token parts:', token?.split('.').length);
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No token provided',
      });
    }
    
    const decoded = decodeToken(token);
    
    console.log('[DecodeToken] Decoded result:', decoded);
    
    return NextResponse.json({
      success: true,
      decoded,
      tokenInfo: {
        length: token.length,
        parts: token.split('.').length,
        header: token.split('.')[0],
        payloadPreview: token.split('.')[1]?.substring(0, 50) + '...',
      },
    });
  } catch (error) {
    console.error('[DecodeToken] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
