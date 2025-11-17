import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@prisma/client';
import { verifyMobileToken } from '@/lib/mobile-session';

export type LiveUpdateEvent =
  | { type: 'services.changed' }
  | { type: 'bookings.updated'; bookingId?: string; userId?: string }
  | { type: 'notifications.updated'; count?: number }
  | { type: 'loyalty.updated'; userId?: string }
  | { type: 'generic'; payload: Record<string, unknown> };

export type LiveUpdateTarget = {
  userIds?: string[];
  roles?: UserRole[];
};

type ClientInfo = {
  ws: WebSocket;
  userId: string | null;
  role: UserRole | null;
};

declare global {
  var __liveUpdatesManager: LiveUpdatesManager | undefined;
  var __wsServer: import('ws').WebSocketServer | undefined;
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
    const payload = JSON.stringify({ ...event, timestamp: Date.now() });
    for (const client of this.clients) {
      if (!this.shouldDeliver(client, target)) {
        continue;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
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

export function publishLiveUpdate(event: LiveUpdateEvent) {
  const wss = global.__wsServer;
  if (!wss) {
    console.warn('[LiveUpdates] WebSocket server not initialized, event not broadcasted:', event.type);
    return;
  }
  
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(JSON.stringify(event));
      } catch (err) {
        console.error('[LiveUpdates] Error broadcasting event:', err);
      }
    }
  });
}
