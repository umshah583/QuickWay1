import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api-response";

// GET /api/admin/devices - Get all logged-in devices
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const user = session.user as { id: string; role: string };
  if (user.role !== "ADMIN") {
    return errorResponse("Access denied", 403);
  }

  try {
    const url = new URL(req.url ?? "http://localhost");
    const userId = url.searchParams.get('userId');

    // Get all active sessions
    const sessions = await prisma.session.findMany({
      where: {
        expires: { gte: new Date() },
        ...(userId && { userId }),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { expires: 'desc' },
    });

    // Parse device info from sessionToken (stored as JSON)
    const devices = sessions.map(session => {
      let deviceInfo = null;
      try {
        deviceInfo = JSON.parse(session.sessionToken);
      } catch (e) {
        // sessionToken might be a regular token, not JSON
        deviceInfo = {
          deviceId: session.sessionToken,
          deviceName: 'Unknown Device',
        };
      }

      return {
        id: session.id,
        userId: session.userId,
        user: session.User,
        deviceId: deviceInfo?.deviceId || session.sessionToken,
        deviceName: deviceInfo?.deviceName || 'Unknown Device',
        deviceType: deviceInfo?.deviceType,
        platform: deviceInfo?.platform,
        appVersion: deviceInfo?.appVersion,
        osVersion: deviceInfo?.osVersion,
        expires: session.expires,
        createdAt: session.expires, // Using expires as proxy for createdAt since Session doesn't have createdAt
      };
    });

    console.log(`[Admin Devices] Found ${devices.length} active devices`);

    return jsonResponse({
      devices,
      total: devices.length,
    });
  } catch (error) {
    console.error('[Admin Devices] Error:', error);
    return errorResponse("Failed to fetch devices", 500);
  }
}

// DELETE /api/admin/devices - Invalidate a device session
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const user = session.user as { id: string; role: string };
  if (user.role !== "ADMIN") {
    return errorResponse("Access denied", 403);
  }

  try {
    const url = new URL(req.url ?? "http://localhost");
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return errorResponse("sessionId parameter is required", 400);
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    console.log(`[Admin Devices] Invalidated session: ${sessionId}`);

    return jsonResponse({
      success: true,
      message: "Device session invalidated",
    });
  } catch (error) {
    console.error('[Admin Devices] Error:', error);
    return errorResponse("Failed to invalidate device", 500);
  }
}
