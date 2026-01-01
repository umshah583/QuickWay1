import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// This route exists to ensure Next.js routing recognizes the endpoint
// The actual WebSocket server is handled by the custom server in server.js
export async function GET(request: NextRequest) {
  // Handle WebSocket upgrade - this will be handled by server.js
  if (request.headers.get('upgrade') === 'websocket') {
    return new Response('WebSocket upgrade handled by server.js', {
      status: 426,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
    });
  }

  return new Response('WebSocket endpoint. Use ws:// protocol.', { status: 200 });
}
