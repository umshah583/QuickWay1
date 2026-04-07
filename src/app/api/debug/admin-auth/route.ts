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
    console.log('[AdminAuth] Testing admin authentication...');
    
    // Get JWT token for socket authentication
    const tokenResponse = await fetch('http://localhost:3000/api/admin/chat-token', { method: 'POST' });
    const tokenData = await tokenResponse.json();
    
    console.log('[AdminAuth] Token response:', tokenData);
    
    if (!tokenData.token) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get admin token',
      });
    }
    
    const decoded = decodeToken(tokenData.token);
    console.log('[AdminAuth] Decoded token:', decoded);
    
    return NextResponse.json({
      success: true,
      tokenInfo: {
        length: tokenData.token.length,
        parts: tokenData.token.split('.').length,
        header: tokenData.token.split('.')[0],
        payloadPreview: tokenData.token.split('.')[1]?.substring(0, 50) + '...',
      },
      decoded,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminAuth] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
