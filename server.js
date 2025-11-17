/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
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
      const { pathname } = parse(request.url, true);
      
      if (pathname === '/api/live-updates') {
        // Authenticate will be handled by the compiled Next.js app's live updates module
        // For now, accept all connections - authentication will be added via the TS module
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
          
          // Basic connection handling
          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
              }
            } catch (err) {
              console.error('WebSocket message error:', err);
            }
          });
          
          ws.on('error', console.error);
        });
      } else {
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
