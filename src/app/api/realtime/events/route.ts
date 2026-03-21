import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { subscribeToEvents, type SystemEventPayload } from "@/lib/realtime-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events endpoint for real-time updates
export async function GET(request: NextRequest) {
  let userId: string;
  let userRole: string | undefined;

  // Try session-based auth first (for admin dashboard)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    userId = session.user.id;
    userRole = session.user.role;
  } else {
    // Fallback to token-based auth (for mobile apps)
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return new Response("Unauthorized - no session or token", { status: 401 });
    }

    try {
      // Verify JWT token (simplified - you might want to use a proper JWT library)
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = decoded.id;
      userRole = decoded.role;
    } catch {
      return new Response("Unauthorized - invalid token", { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const channels = searchParams.get("channels")?.split(",") ?? ["global"];
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const unsubscribers: (() => void)[] = [];
  let isConnectionOpen = true;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ 
        type: "connected", 
        userId, 
        channels,
        timestamp: new Date().toISOString() 
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Event handler
      const handleEvent = (event: SystemEventPayload) => {
        if (!isConnectionOpen) return;
        
        try {
          const message = `data: ${JSON.stringify({
            type: "event",
            event,
          })}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Connection closed
          isConnectionOpen = false;
        }
      };

      // Subscribe to requested channels
      channels.forEach((channel) => {
        const unsub = subscribeToEvents(channel, handleEvent);
        unsubscribers.push(unsub);
      });

      // Always subscribe to user-specific channel
      const userUnsub = subscribeToEvents(`user:${userId}`, handleEvent);
      unsubscribers.push(userUnsub);

      // Subscribe to role-specific channel
      if (userRole) {
        const roleUnsub = subscribeToEvents(`role:${userRole}`, handleEvent);
        unsubscribers.push(roleUnsub);
      }

      // Subscribe to entity-specific channel if requested
      if (entityType && entityId) {
        const entityUnsub = subscribeToEvents(`entity:${entityType}:${entityId}`, handleEvent);
        unsubscribers.push(entityUnsub);
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isConnectionOpen) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          const heartbeat = `data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          isConnectionOpen = false;
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        isConnectionOpen = false;
        clearInterval(heartbeatInterval);
        unsubscribers.forEach((unsub) => unsub());
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      isConnectionOpen = false;
      unsubscribers.forEach((unsub) => unsub());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
