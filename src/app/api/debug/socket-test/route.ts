import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    console.log('[SocketTest] Testing Socket.IO server...');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any).__socketServer;
    
    if (!io) {
      return NextResponse.json({
        success: false,
        error: 'Socket.IO server not found',
      });
    }
    
    // Get server info
    const serverInfo = {
      exists: !!io,
      connectedClients: (global as any).connectedClients?.size || 0,
      socketsCount: io.sockets?.sockets?.size || 0,
      rooms: io.sockets?.adapter?.rooms?.size || 0,
    };
    
    // Get all connected clients with proper typing
    const connectedClients: Array<{
      userId: string;
      socketCount: number;
      socketIds: string[];
    }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).connectedClients?.forEach((sockets: Set<any>, userId: string) => {
      connectedClients.push({
        userId,
        socketCount: sockets.size,
        socketIds: Array.from(sockets).map((s: any) => s.id),
      });
    });
    
    // Get all rooms with proper typing
    const rooms: Array<{
      name: string;
      socketCount: number;
    }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    io.sockets?.adapter?.rooms?.forEach((sockets: Set<any>, roomName: string) => {
      rooms.push({
        name: roomName,
        socketCount: sockets.size,
      });
    });
    
    console.log('[SocketTest] Server info:', serverInfo);
    console.log('[SocketTest] Connected clients:', connectedClients);
    console.log('[SocketTest] Rooms:', rooms);
    
    return NextResponse.json({
      success: true,
      serverInfo,
      connectedClients,
      rooms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SocketTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
