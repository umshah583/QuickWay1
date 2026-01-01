/**
 * SOCKET GATEWAY V2
 * ==================
 * Clean-slate socket server with STRICT app isolation
 * NO legacy code, NO role checks, NO shared rooms
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { AppType, SocketAuthPayload, SocketNotificationPayload } from './types';
import { getRoomName, SOCKET_EVENTS } from './types';
import { registerSocketServer } from './notification-service';

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

// Global reference to prevent multiple instances
declare global {
  var __notificationGatewayV2: NotificationGatewayV2 | undefined;
}

// Connected client info
interface ConnectedClient {
  socket: Socket;
  userId: string;
  appType: AppType;
  permissions: string[];
  connectedAt: Date;
}

/**
 * NOTIFICATION GATEWAY V2
 * Handles all socket connections with strict app isolation
 */
export class NotificationGatewayV2 {
  private io: SocketIOServer;
  private clients: Map<string, ConnectedClient> = new Map();

  constructor(httpServer: HttpServer) {
    // Create Socket.IO server on NEW namespace to avoid conflicts
    this.io = new SocketIOServer(httpServer, {
      path: '/api/notifications-v2/socket',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.registerWithNotificationService();

    console.log('[NotificationGatewayV2] ✅ Initialized on /api/notifications-v2/socket');
  }

  /**
   * Authentication middleware - STRICT validation
   */
  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        const appType = socket.handshake.auth?.appType as AppType;

        // REQUIRED: Both token and appType
        if (!token) {
          return next(new Error('AUTHENTICATION_REQUIRED: No token provided'));
        }
        if (!appType || !['CUSTOMER', 'DRIVER'].includes(appType)) {
          return next(new Error('APP_TYPE_REQUIRED: Must specify appType (CUSTOMER or DRIVER)'));
        }

        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET) as {
          sub?: string;
          userId?: string;
          appType?: AppType;
          permissions?: string[];
        };

        const userId = decoded.sub || decoded.userId;
        if (!userId) {
          return next(new Error('INVALID_TOKEN: No user ID in token'));
        }

        // CRITICAL: Validate appType matches token claim (if present)
        if (decoded.appType && decoded.appType !== appType) {
          return next(new Error(`APP_TYPE_MISMATCH: Token is for ${decoded.appType}, but connected as ${appType}`));
        }

        // Attach auth data to socket
        (socket as Socket & { authData: SocketAuthPayload }).authData = {
          userId,
          appType,
          permissions: decoded.permissions || [],
        };

        console.log(`[NotificationGatewayV2] ✅ Auth success: ${appType}:${userId}`);
        next();
      } catch (error) {
        console.error('[NotificationGatewayV2] ❌ Auth failed:', error);
        next(new Error('AUTHENTICATION_FAILED'));
      }
    });
  }

  /**
   * Setup connection handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket & { authData?: SocketAuthPayload }) => {
      const auth = socket.authData;
      if (!auth) {
        socket.disconnect(true);
        return;
      }

      const { userId, appType, permissions } = auth;
      const clientKey = `${appType}:${userId}:${socket.id}`;

      // Store client
      this.clients.set(clientKey, {
        socket,
        userId,
        appType,
        permissions,
        connectedAt: new Date(),
      });

      // Join rooms (ALL prefixed with appType)
      const userRoom = getRoomName.user(appType, userId);
      const appRoom = getRoomName.app(appType);
      
      socket.join(userRoom);
      socket.join(appRoom);

      // Join permission rooms
      for (const perm of permissions) {
        socket.join(getRoomName.permission(appType, perm));
      }

      console.log(`[NotificationGatewayV2] 🔗 Connected: ${clientKey} | Rooms: ${userRoom}, ${appRoom}`);

      // Send connection confirmation
      socket.emit('connected', {
        userId,
        appType,
        rooms: [userRoom, appRoom],
        timestamp: new Date().toISOString(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.clients.delete(clientKey);
        console.log(`[NotificationGatewayV2] 🔌 Disconnected: ${clientKey} | Reason: ${reason}`);
      });

      // Handle ping (for connection health)
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  /**
   * Register with notification service for sending
   */
  private registerWithNotificationService(): void {
    registerSocketServer({
      emitToRoom: (room: string, event: string, payload: SocketNotificationPayload) => {
        this.io.to(room).emit(event, payload);
        console.log(`[NotificationGatewayV2] 📤 Emit to room ${room}: ${event}`);
      },
      emitToUser: (appType: AppType, userId: string, event: string, payload: SocketNotificationPayload) => {
        const room = getRoomName.user(appType, userId);
        this.io.to(room).emit(event, payload);
        console.log(`[NotificationGatewayV2] 📤 Emit to user ${appType}:${userId}: ${event}`);
      },
    });
  }

  /**
   * Get connection stats
   */
  public getStats(): { totalConnections: number; byApp: Record<AppType, number> } {
    const stats = { totalConnections: 0, byApp: { CUSTOMER: 0, DRIVER: 0 } };
    
    for (const client of this.clients.values()) {
      stats.totalConnections++;
      stats.byApp[client.appType]++;
    }
    
    return stats;
  }

  /**
   * Check if user is connected to specific app
   */
  public isUserConnected(userId: string, appType: AppType): boolean {
    for (const client of this.clients.values()) {
      if (client.userId === userId && client.appType === appType) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Initialize notification gateway (singleton)
 */
export function initNotificationGateway(httpServer: HttpServer): NotificationGatewayV2 {
  if (!globalThis.__notificationGatewayV2) {
    globalThis.__notificationGatewayV2 = new NotificationGatewayV2(httpServer);
  }
  return globalThis.__notificationGatewayV2;
}

/**
 * Get gateway instance
 */
export function getNotificationGateway(): NotificationGatewayV2 | undefined {
  return globalThis.__notificationGatewayV2;
}
