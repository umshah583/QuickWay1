export const dynamic = 'force-dynamic';

// This route will be handled by the custom server's WebSocket upgrade logic
// It exists to ensure Next.js routing recognizes the endpoint
export async function GET() {
  return new Response('WebSocket endpoint. Use ws:// protocol.', {
    status: 426,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
    },
  });
}
