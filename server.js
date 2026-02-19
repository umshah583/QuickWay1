/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { jwtVerify } = require('jose');

const dev = process.env.NODE_ENV !== 'production';
// Use 0.0.0.0 in development for mobile emulator access, production (Render) also uses 0.0.0.0
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Simple in-memory storage for Socket.IO connections
// In production, you'd want to use Redis or similar
// Store array of sockets per user to handle multiple connections
const connectedClients = new Map(); // userId -> Set of sockets

// JWT secret - use same secret as mobile-session.ts
const JWT_SECRET = (process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-jwt-secret').trim();
const encoder = new TextEncoder();

console.log('[WebSocket] JWT_SECRET loaded:', JWT_SECRET ? `${JWT_SECRET.substring(0, 10)}...` : 'NOT SET');

// Decode JWT token without verification (for WebSocket connections)
function decodeToken(token) {
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
    console.error('[WebSocket] Token decode failed:', error.message);
    return null;
  }
}

// Verify JWT token with signature check (for secure operations)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function verifyToken(token) {
  try {
    const secret = encoder.encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch (error) {
    console.error('[WebSocket] Token verification failed:', error.message);
    return null;
  }
}

function broadcastToUser(userId, event) {
  console.log(`[Socket.IO] Looking for user ${userId} in ${connectedClients.size} connected clients`);
  const userSockets = connectedClients.get(userId);
  console.log(`[Socket.IO] Found ${userSockets ? userSockets.size : 0} sockets for user ${userId}`);
  
  if (userSockets && userSockets.size > 0) {
    let sentCount = 0;
    userSockets.forEach((socket) => {
      if (socket && socket.connected) {
        try {
          socket.emit('live-update', event);
          sentCount++;
        } catch (error) {
          console.error(`[Socket.IO] Failed to send to user ${userId}:`, error);
          userSockets.delete(socket);
        }
      } else {
        userSockets.delete(socket);
      }
    });
    
    if (sentCount > 0) {
      console.log(`[Socket.IO] ✅ Sent event to user ${userId} (${sentCount} sockets):`, event.type);
    } else {
      console.log(`[Socket.IO] ❌ No connected sockets for user ${userId}`);
      connectedClients.delete(userId);
    }
  } else {
    console.log(`[Socket.IO] ❌ No sockets found for user ${userId}`);
  }
}

function broadcastToAll(event) {
  console.log(`[Socket.IO] Broadcasting to all ${connectedClients.size} clients:`, event.type || event.payload?.event);
  console.log(`[Socket.IO] Connected users:`, Array.from(connectedClients.keys()));
  
  let sentCount = 0;
  for (const [userId, sockets] of connectedClients.entries()) {
    console.log(`[Socket.IO] User ${userId} has ${sockets.size} sockets`);
    for (const socket of sockets) {
      if (socket && socket.connected) {
        console.log(`[Socket.IO] Sending to socket ${socket.id} for user ${userId}`);
        socket.emit('live-update', { ...event, timestamp: Date.now() });
        sentCount++;
      } else {
        console.log(`[Socket.IO] Socket ${socket.id} not connected`);
      }
    }
  }
  
  console.log(`[Socket.IO] Successfully sent to ${sentCount} clients`);
}

// Handle subscription-related events
function handleSubscriptionEvent(eventType, data) {
  try {
    console.log(`[SubscriptionEvent] Handling: ${eventType}`, data);
    
    switch (eventType) {
      case 'subscription.request.created':
        // Broadcast to ALL connected clients (admins will see it)
        broadcastToAll({
          type: 'subscription.request.created',
          requestId: data.requestId,
          userId: data.userId,
          packageId: data.packageId,
          timestamp: Date.now()
        });
        console.log('[SubscriptionEvent] ✅ Broadcasted subscription.request.created to all');
        break;

      case 'subscription.created':
        if (data.userId) {
          broadcastToUser(data.userId, {
            type: 'subscription.created',
            subscriptionId: data.subscriptionId,
            userId: data.userId
          });
        }
        // Also broadcast to all for admin panel
        broadcastToAll({
          type: 'subscription.created',
          subscriptionId: data.subscriptionId,
          userId: data.userId,
          timestamp: Date.now()
        });
        break;

      case 'subscription.status.updated':
        if (data.userId) {
          broadcastToUser(data.userId, {
            type: 'subscription.status.updated',
            subscriptionId: data.subscriptionId,
            status: data.status,
            userId: data.userId
          });
        }
        // Also broadcast to all for admin panel
        broadcastToAll({
          type: 'subscription.status.updated',
          subscriptionId: data.subscriptionId,
          status: data.status,
          timestamp: Date.now()
        });
        break;

      case 'subscription.request.approved':
        if (data.userId) {
          broadcastToUser(data.userId, {
            type: 'subscription.request.approved',
            requestId: data.requestId,
            subscriptionId: data.subscriptionId,
            userId: data.userId
          });
        }
        // Also broadcast to all for admin panel refresh
        broadcastToAll({
          type: 'subscription.request.approved',
          requestId: data.requestId,
          timestamp: Date.now()
        });
        console.log('[SubscriptionEvent] ✅ Broadcasted subscription.request.approved');
        break;

      case 'subscription.request.rejected':
        if (data.userId) {
          broadcastToUser(data.userId, {
            type: 'subscription.request.rejected',
            requestId: data.requestId,
            reason: data.reason,
            userId: data.userId
          });
        }
        // Also broadcast to all for admin panel refresh
        broadcastToAll({
          type: 'subscription.request.rejected',
          requestId: data.requestId,
          timestamp: Date.now()
        });
        console.log('[SubscriptionEvent] ✅ Broadcasted subscription.request.rejected');
        break;

      default:
        console.log(`[WebSocket] Unknown subscription event: ${eventType}`);
    }
  } catch (error) {
    console.error('[WebSocket] Error handling subscription event:', error);
  }
}

// Export for use in API routes
global.handleSubscriptionEvent = handleSubscriptionEvent;
global.broadcastToUser = broadcastToUser;
global.broadcastToAll = broadcastToAll;
global.hasUserConnection = hasUserConnection;

// Track active socket connections by userId and appType
const activeSocketConnections = new Map(); // userId -> Set of { socketId, appType }

function addSocketConnection(userId, socketId, appType) {
  if (!activeSocketConnections.has(userId)) {
    activeSocketConnections.set(userId, new Set());
  }
  activeSocketConnections.get(userId).add({ socketId, appType });
  console.log(`[Socket.IO] Added connection: user ${userId}, socket ${socketId}, appType ${appType}`);
}

function removeSocketConnection(userId, socketId) {
  if (activeSocketConnections.has(userId)) {
    const userSockets = activeSocketConnections.get(userId);
    userSockets.forEach(connection => {
      if (connection.socketId === socketId) {
        userSockets.delete(connection);
      }
    });
    if (userSockets.size === 0) {
      activeSocketConnections.delete(userId);
    }
    console.log(`[Socket.IO] Removed connection: user ${userId}, socket ${socketId}`);
  }
}

function hasUserConnection(userId, appType) {
  if (!activeSocketConnections.has(userId)) {
    return false;
  }
  const userSockets = activeSocketConnections.get(userId);
  return Array.from(userSockets).some(connection => connection.appType === appType);
}

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    console.log(`[Server] 📨 REQUEST RECEIVED: ${req.method} ${req.url}`);
    
    // Debug URL matching
    console.log(`[Server] 🔍 URL DEBUG: req.url = "${req.url}"`);
    console.log(`[Server] 🔍 URL DEBUG: req.method = "${req.method}"`);
    console.log(`[Server] 🔍 URL DEBUG: expected url = "/internal/trigger-system-notification"`);
    console.log(`[Server] 🔍 URL DEBUG: url match = ${req.url === '/internal/trigger-system-notification'}`);
    console.log(`[Server] 🔍 URL DEBUG: method match = ${req.method === 'POST'}`);
    
    // Handle internal system notification trigger
    if (req.url === '/internal/trigger-system-notification' && req.method === 'POST') {
      console.log('[InternalSystemNotification] 🎯 URL MATCHED - Processing system notification request');
      console.log('[InternalSystemNotification] 🔄 ENDPOINT HIT - Processing request');
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        console.log('[InternalSystemNotification] 📦 Raw body received:', body);
        try {
          const { message, title } = JSON.parse(body);
          console.log('[InternalSystemNotification] ✅ Parsed body:', { message, title });
          
          // Inline publishLiveUpdate logic for system notifications
          console.log('[InternalSystemNotification] 🚀 Emitting to Socket.IO directly...');
          
          const io = globalThis.__socketServer;
          if (!io) {
            throw new Error('Socket.IO server not available');
          }
          
          // Create the system notification event
          const event = {
            type: 'system.notification.new',
            id: `system-${Date.now()}`,
            title: title || 'System Notification',
            message,
            createdAt: new Date().toISOString()
          };
          
          console.log('[InternalSystemNotification] 📤 SOCKET VERIFICATION:');
          console.log('[InternalSystemNotification] - Socket.IO instance exists:', !!io);
          console.log('[InternalSystemNotification] - Same instance used by emitters:', io === globalThis.__socketServer);
          console.log('[InternalSystemNotification] - Event to emit:', JSON.stringify(event, null, 2));
          
          // Get room information
          const customerRoom = io.sockets.adapter.rooms.get('customer:system');
          const driverRoom = io.sockets.adapter.rooms.get('driver:system');
          console.log('[InternalSystemNotification] - Rooms at emit time:');
          console.log('[InternalSystemNotification]   - customer:system:', customerRoom ? customerRoom.size : 0, 'sockets');
          console.log('[InternalSystemNotification]   - driver:system:', driverRoom ? driverRoom.size : 0, 'sockets');
          console.log('[InternalSystemNotification] - Total connected sockets:', io.sockets.sockets.size);
          
          // Emit to customer system room
          console.log('[InternalSystemNotification] 🏠 Broadcasting to customer:system...');
          const customerEmitResult = io.to('customer:system').emit('live-update', event);
          console.log('[InternalSystemNotification] ✅ Customer emit result:', customerEmitResult);
          
          // Emit to driver system room  
          console.log('[InternalSystemNotification] 🏠 Broadcasting to driver:system...');
          const driverEmitResult = io.to('driver:system').emit('live-update', event);
          console.log('[InternalSystemNotification] ✅ Driver emit result:', driverEmitResult);
          
          console.log('[InternalSystemNotification] ✅ Socket.IO emission completed');
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, triggered: true }));
          console.log('[InternalSystemNotification] ✅ Response sent');
        } catch (error) {
          console.error('[InternalSystemNotification] ❌ Error in endpoint:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
    
    console.log(`[Server] ➡️  PASSING TO NEXT.JS: ${req.method} ${req.url}`);
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Configure server timeouts for long-lived connections
  server.keepAliveTimeout = 120000; // 120 seconds
  server.headersTimeout = 125000; // Slightly more than keepAliveTimeout

  // Initialize Socket.IO server
  try {
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      path: '/socket.io/'
    });

    // Handle Socket.IO connections
    io.on('connection', (socket) => {
      console.log(`[Socket.IO] Client connected: ${socket.id}`);
      
      let authenticatedUser = null;

      // Send welcome message immediately
      socket.emit('connected', {
        timestamp: Date.now(),
        message: 'Connected - please authenticate'
      });

      // Handle authentication
      socket.on('auth', async (data) => {
        try {
          console.log('[Socket.IO] Received auth message');
          const { token } = data;
          
          if (token) {
            authenticatedUser = decodeToken(token);
            if (authenticatedUser) {
              // Add socket to user's set of connections
              if (!connectedClients.has(authenticatedUser.id)) {
                connectedClients.set(authenticatedUser.id, new Set());
              }
              connectedClients.get(authenticatedUser.id).add(socket);
              
              console.log(`[Socket.IO] User ${authenticatedUser.email} authenticated (id: ${authenticatedUser.id})`);
              console.log(`[Socket.IO] User now has ${connectedClients.get(authenticatedUser.id).size} active connections`);
              
              // Join notification rooms based on app type
              const appType = authenticatedUser.role === 'DRIVER' ? 'driver' : 'customer';
              
              // Join system room for system notifications
              const systemRoom = `${appType}:system`;
              socket.join(systemRoom);
              console.log(`[Socket.IO] User joined system room: ${systemRoom}`);
              
              // Track active connection for conditional delivery
              addSocketConnection(authenticatedUser.id, socket.id, appType.toUpperCase());
            } else {
              console.log('[Socket.IO] Authentication failed - invalid token');
              socket.emit('auth_failed', {
                message: 'Invalid authentication token'
              });
            }
          }
        } catch (error) {
          console.error('[Socket.IO] Auth error:', error);
          socket.emit('auth_failed', {
            message: 'Authentication error'
          });
        }
      });

      // Handle chat join/leave events
      socket.on('join_chat', (data) => {
        try {
          if (!authenticatedUser) {
            socket.emit('auth_required', { message: 'Authentication required for chat' });
            return;
          }
          
          const { conversationId } = data;
          if (conversationId) {
            socket.join(`chat:${conversationId}`);
            console.log(`[Socket.IO] User ${authenticatedUser.id} joined chat room: ${conversationId}`);
            socket.emit('chat_joined', { conversationId });
          }
        } catch (error) {
          console.error('[Socket.IO] Error joining chat:', error);
          socket.emit('chat_error', { message: 'Failed to join chat' });
        }
      });

      socket.on('leave_chat', (data) => {
        try {
          const { conversationId } = data;
          if (conversationId) {
            socket.leave(`chat:${conversationId}`);
            console.log(`[Socket.IO] User ${authenticatedUser?.id || 'unknown'} left chat room: ${conversationId}`);
          }
        } catch (error) {
          console.error('[Socket.IO] Error leaving chat:', error);
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        try {
          if (!authenticatedUser) return;
          
          const { conversationId } = data;
          if (conversationId) {
            socket.to(`chat:${conversationId}`).emit('user_typing', {
              userId: authenticatedUser.id,
              userName: authenticatedUser.name || authenticatedUser.email,
              conversationId
            });
          }
        } catch (error) {
          console.error('[Socket.IO] Error handling typing start:', error);
        }
      });

      socket.on('typing_stop', (data) => {
        try {
          if (!authenticatedUser) return;
          
          const { conversationId } = data;
          if (conversationId) {
            socket.to(`chat:${conversationId}`).emit('user_stopped_typing', {
              userId: authenticatedUser.id,
              conversationId
            });
          }
        } catch (error) {
          console.error('[Socket.IO] Error handling typing stop:', error);
        }
      });

      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
        if (authenticatedUser) {
          const userSockets = connectedClients.get(authenticatedUser.id);
          if (userSockets) {
            userSockets.delete(socket);
            if (userSockets.size === 0) {
              connectedClients.delete(authenticatedUser.id);
              console.log(`[Socket.IO] Removed user ${authenticatedUser.email} - no more connections`);
            } else {
              console.log(`[Socket.IO] User ${authenticatedUser.email} still has ${userSockets.size} connections`);
            }
          }
          
          // Remove from active connection tracking
          removeSocketConnection(authenticatedUser.id, socket.id);
        }
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error('[Socket.IO] Socket error:', error);
        if (authenticatedUser) {
          connectedClients.delete(authenticatedUser.id);
        }
      });
    });

    // Make Socket.IO globally available for the Next.js app
    global.__socketServer = io;

    console.log('✓ Socket.IO server initialized');
    
    // Test live updates after 10 seconds
    setTimeout(() => {
      console.log('[Test] Broadcasting test live update...');
      broadcastToAll({
        type: 'generic',
        payload: { 
          event: 'test.broadcast', 
          message: 'Test broadcast - if you see this, live updates are working!',
          timestamp: Date.now()
        }
      });
    }, 10000);
  } catch (err) {
    console.error('Failed to initialize WebSocket server:', err);
  }

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Live updates available via Socket.IO at http://${hostname}:${port}`);
  });
});
