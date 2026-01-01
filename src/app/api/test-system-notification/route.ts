import { NextRequest, NextResponse } from 'next/server';
import { emitBusinessEvent } from '@/lib/business-events';

// Type definition for Socket.IO server (minimal interface for what we need)
interface SocketIOServer {
  sockets: {
    adapter: {
      rooms: Map<string, Set<string>>;
    };
    sockets: Map<string, unknown>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message, title } = await request.json();

    console.log('[TestSystemNotification] Emitting system notification:', { message, title });

    emitBusinessEvent('system.announcement', {
      message: message || 'Test system notification',
      title: title || 'Test Notification'
    });

    return NextResponse.json({
      success: true,
      message: 'System notification emitted',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[TestSystemNotification] Error:', error);
    return NextResponse.json(
      { error: 'Failed to emit system notification' },
      { status: 500 }
    );
  }
}

export async function GET() {
  console.log('[TestSystemNotification] GET request - emitting test system notification');

  // STEP 1: Prove Socket.IO instance exists and is the same
  const io = globalThis.__socketServer;
  console.log('[TestSystemNotification] Socket.IO server reference:', !!io);
  console.log('[TestSystemNotification] Socket.IO server type:', typeof io);

  // STEP 2: Check if running in serverless mode
  const isServerless = !io;
  console.log('[TestSystemNotification] Running in serverless mode:', isServerless);

  if (io) {
    // Type assertion for Socket.IO server
    const socketServer = io as SocketIOServer;
    
    // STEP 3: Log all rooms at emit time
    console.log('[TestSystemNotification] All Socket.IO rooms:', Array.from(socketServer.sockets.adapter.rooms.keys()));

    // STEP 4: Log sockets in system rooms
    const customerRoom = socketServer.sockets.adapter.rooms.get('customer:system');
    const driverRoom = socketServer.sockets.adapter.rooms.get('driver:system');

    console.log('[TestSystemNotification] Customer system room exists:', !!customerRoom);
    console.log('[TestSystemNotification] Customer system room sockets:', customerRoom ? Array.from(customerRoom) : 'NONE');

    console.log('[TestSystemNotification] Driver system room exists:', !!driverRoom);
    console.log('[TestSystemNotification] Driver system room sockets:', driverRoom ? Array.from(driverRoom) : 'NONE');

    // STEP 5: Log connected sockets count
    console.log('[TestSystemNotification] Total connected sockets:', socketServer.sockets.sockets.size);
  } else {
    console.log('[TestSystemNotification] ❌ CRITICAL: No Socket.IO server found - running in serverless mode!');
  }

  console.log('[TestSystemNotification] About to call emitBusinessEvent...');

  emitBusinessEvent('system.announcement', {
    message: 'This is a test system notification from the server',
    title: 'Test System Notification'
  });

  console.log('[TestSystemNotification] emitBusinessEvent called successfully');

  return NextResponse.json({
    success: true,
    message: 'Test system notification emitted - check mobile apps',
    timestamp: Date.now(),
    socketServerExists: !!io,
    isServerless: !io,
    rooms: io ? Array.from((io as SocketIOServer).sockets.adapter.rooms.keys()) : null,
    customerRoomSockets: io ? (io as SocketIOServer).sockets.adapter.rooms.get('customer:system')?.size || 0 : 0,
    driverRoomSockets: io ? (io as SocketIOServer).sockets.adapter.rooms.get('driver:system')?.size || 0 : 0,
    totalSockets: io ? (io as SocketIOServer).sockets.sockets.size || 0 : 0
  });
}
