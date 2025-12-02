/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
// Use 0.0.0.0 in production (Render) to accept external connections
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global WebSocket server instance
let wss = null;

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Handle WebSocket upgrade for /api/live-updates
      if (req.url?.startsWith('/api/live-updates') && req.headers.upgrade === 'websocket') {
        // Let WebSocketServer handle the upgrade
        return;
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize WebSocket server
  try {
    wss = new WebSocketServer({ 
      noServer: true,
      path: '/api/live-updates'
    });

    // Handle upgrade requests
    server.on('upgrade', async (request, socket, head) => {
      try {
        const { pathname } = parse(request.url, true);
        
        if (pathname === '/api/live-updates') {
          // Log connection attempt
          console.log('[WebSocket] Upgrade request from:', request.headers.origin || 'unknown');
          
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
            
            // Send welcome message immediately on connection
            ws.send(JSON.stringify({ 
              type: 'connected', 
              timestamp: Date.now(),
              message: 'Live updates connected'
            }));
            
            // Basic connection handling
            ws.on('message', (data) => {
              try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'ping') {
                  ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                }
              } catch (err) {
                console.error('WebSocket message error:', err);
              }
            });
            
            ws.on('error', (err) => {
              console.error('[WebSocket] Client error:', err);
            });
            
            ws.on('close', () => {
              console.log('[WebSocket] Client disconnected');
            });
            
            console.log('[WebSocket] Client connected successfully');
          });
        } else {
          socket.destroy();
        }
      } catch (err) {
        console.error('[WebSocket] Upgrade error:', err);
        socket.destroy();
      }
    });

    // Make WSS globally available for the Next.js app
    global.__wsServer = wss;
    
    console.log('✓ Live updates WebSocket initialized');
  } catch (err) {
    console.error('Failed to initialize WebSocket server:', err);
  }

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Live updates available at ws://${hostname}:${port}/api/live-updates`);
  });
});
