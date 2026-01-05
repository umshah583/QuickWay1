import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@prisma/client';
import { verifyMobileToken } from '@/lib/mobile-session';

export type LiveUpdateEvent =
  | { type: 'services.changed' }
  | { type: 'bookings.updated'; bookingId?: string; userId?: string }
  | { type: 'bookings.created'; bookingId?: string; userId?: string }
  | { type: 'system.notification.new'; id?: string; title?: string; message?: string; createdAt?: string }
  | { type: 'notifications.updated'; count?: number }
  | { type: 'loyalty.updated'; userId?: string }
  | { type: 'subscription.request.approved'; requestId?: string; userId?: string }
  | { type: 'subscription.request.rejected'; requestId?: string; userId?: string; reason?: string }
  | { type: 'generic'; payload: Record<string, unknown> };

export type LiveUpdateTarget = {
  userIds?: string[];
  roles?: UserRole[];
  room?: string;
};

type ClientInfo = {
  ws: WebSocket;
  userId: string | null;
  role: UserRole | null;
};

declare global {
  var __liveUpdatesManager: LiveUpdatesManager | undefined;
  var __wsServer: import('ws').WebSocketServer | undefined;
  var __socketServer: unknown; // Socket.IO server instance
  var broadcastToUser: ((userId: string, event: unknown) => void) | undefined;
  var broadcastToAll: ((event: unknown) => void) | undefined;
  var emitBusinessEvent: ((event: string, context: unknown) => void) | undefined;
}

class LiveUpdatesManager {
  private wss = new WebSocketServer({ noServer: true });
  private clients: Set<ClientInfo> = new Set();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(private server: Server) {
    this.server.on('upgrade', this.handleUpgrade);
    this.heartbeatInterval = setInterval(this.pingClients, 30_000);
    this.heartbeatInterval.unref();
  }

  public broadcast(event: LiveUpdateEvent, target?: LiveUpdateTarget) {
    console.log('[LiveUpdates] 🔄 BROADCAST EVENT:', event.type);
    console.log('[LiveUpdates] 📦 Payload:', JSON.stringify(event, null, 2));
    console.log('[LiveUpdates] 🎯 Target:', target ? JSON.stringify(target, null, 2) : 'ALL CLIENTS');

    const payload = JSON.stringify({ ...event, timestamp: Date.now() });
    let deliveredCount = 0;

    for (const client of this.clients) {
      if (!this.shouldDeliver(client, target)) {
        console.log('[LiveUpdates] ⏭️ Skipping client (does not match target):', {
          clientUserId: client.userId,
          clientRole: client.role,
          target: target
        });
        continue;
      }

      console.log('[LiveUpdates] ✅ Delivering to client:', {
        userId: client.userId,
        role: client.role,
        readyState: client.ws.readyState
      });

      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
          deliveredCount++;
          console.log('[LiveUpdates] 📤 Sent to client successfully');
        } catch (error) {
          console.error('[LiveUpdates] ❌ Failed to send to client:', error);
        }
      } else {
        console.log('[LiveUpdates] ⚠️ Client WebSocket not open, skipping');
      }
    }

    console.log(`[LiveUpdates] 📊 Broadcast complete: ${deliveredCount} clients received the event`);
  }

  private shouldDeliver(client: ClientInfo, target?: LiveUpdateTarget) {
    if (!target) return true;
    if (target.userIds?.length) {
      return Boolean(client.userId && target.userIds.includes(client.userId));
    }
    if (target.roles?.length) {
      return Boolean(client.role && target.roles.includes(client.role));
    }
    return true;
  }

  private handleUpgrade = async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { url = '' } = req;
    if (!url.startsWith('/api/live-updates')) {
      return;
    }

    const authContext = await this.authenticate(req);
    if (!authContext) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, ws => {
      this.handleConnection(ws, authContext);
    });
  };

  private async authenticate(req: IncomingMessage): Promise<{ userId: string | null; role: UserRole | null } | null> {
    try {
      const token = await getToken({ req: req as unknown as Parameters<typeof getToken>[0]['req'], secret: process.env.NEXTAUTH_SECRET });
      if (token?.sub) {
        return {
          userId: String(token.sub),
          role: (token as { role?: UserRole }).role ?? null,
        };
      }
    } catch (error) {
      console.warn('Failed to read NextAuth token for live updates', error);
    }

    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const [scheme, value] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) {
        try {
          const mobilePayload = await verifyMobileToken(value);
          return {
            userId: mobilePayload.sub,
            role: mobilePayload.role ?? null,
          };
        } catch (error) {
          console.warn('Invalid mobile token for live updates', error);
        }
      }
    }

    return null;
  }

  private handleConnection(ws: WebSocket, context: { userId: string | null; role: UserRole | null }) {
    const client: ClientInfo = { ws, userId: context.userId, role: context.role };
    (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    this.clients.add(client);

    ws.on('close', () => {
      this.clients.delete(client);
    });

    ws.on('pong', () => {
      (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    });

    ws.send(
      JSON.stringify({
        type: 'connected',
        userId: context.userId,
        role: context.role,
        timestamp: Date.now(),
      }),
    );
  }

  private pingClients = () => {
    for (const client of this.clients) {
      if ((client.ws as WebSocket & { isAlive: boolean }).isAlive === false) {
        client.ws.terminate();
        this.clients.delete(client);
        continue;
      }
      (client.ws as WebSocket & { isAlive: boolean }).isAlive = false;
      try {
        client.ws.ping();
      } catch (error) {
        console.warn('Failed to ping websocket client', error);
        this.clients.delete(client);
      }
    }
  };
}

export function initLiveUpdates(server: Server) {
  if (!globalThis.__liveUpdatesManager) {
    globalThis.__liveUpdatesManager = new LiveUpdatesManager(server);
  }
  return globalThis.__liveUpdatesManager;
}

export function publishLiveUpdate(event: LiveUpdateEvent, target?: LiveUpdateTarget) {
  console.log('[publishLiveUpdate] 🚀 PUBLISHING EVENT:', event.type);
  console.log('[publishLiveUpdate] 📦 Event payload:', JSON.stringify(event, null, 2));
  console.log('[publishLiveUpdate] 🎯 Target:', target ? JSON.stringify(target, null, 2) : 'ALL CLIENTS');

  // ✅ FIX: Use Socket.IO server instead of WebSocket server
  // The mobile apps connect via Socket.IO, not raw WebSocket
  const socketServer = globalThis.__socketServer;
  const broadcastToUser = globalThis.broadcastToUser;
  const broadcastToAll = globalThis.broadcastToAll;

  console.log('[publishLiveUpdate] 🔍 DEBUG: socketServer exists:', !!socketServer);
  console.log('[publishLiveUpdate] 🔍 DEBUG: broadcastToUser exists:', !!broadcastToUser);
  console.log('[publishLiveUpdate] 🔍 DEBUG: broadcastToAll exists:', !!broadcastToAll);

  if (!socketServer || !broadcastToUser || !broadcastToAll) {
    console.error('[publishLiveUpdate] ❌ Socket.IO server not initialized!');
    console.error('[publishLiveUpdate] Make sure server.js is running, not Next.js dev server');
    return;
  }

  // Determine if this is a targeted broadcast or broadcast to all
  if (target?.userIds?.length) {
    // Target specific users
    console.log('[publishLiveUpdate] 🎯 Unicasting to specific users:', target.userIds);
    target.userIds.forEach(userId => {
      console.log(`[publishLiveUpdate] 📤 Emitting to user ${userId}...`);
      broadcastToUser(userId, event);
    });
  } else if (target?.room) {
    // Target specific room (for system notifications)
    console.log('[publishLiveUpdate] 🏠 Broadcasting to room:', target.room);
    const io = globalThis.__socketServer as { to: (room: string) => { emit: (event: string, data: unknown) => void } } | undefined;
    if (io) {
      const roomName = target.room === 'system' ? ['customer:system', 'driver:system'] : [target.room];
      roomName.forEach(room => {
        console.log(`[publishLiveUpdate] 📤 Emitting to room ${room}...`);
        io.to(room).emit('live-update', event);
      });
      console.log('[publishLiveUpdate] ✅ Event published to system rooms');
    } else {
      console.error('[publishLiveUpdate] ❌ Socket.IO server not available for room broadcast');
    }
  } else {
    // Broadcast to all connected clients
    console.log('[publishLiveUpdate] 📢 Broadcasting to ALL clients');
    broadcastToAll(event);
  }

  console.log('[publishLiveUpdate] ✅ Event published successfully');
}
