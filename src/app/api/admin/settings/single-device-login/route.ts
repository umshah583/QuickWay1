import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api-response";

// GET /api/admin/settings/single-device-login - Get single device login setting
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
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'single_device_login_enabled' }
    });

    return jsonResponse({
      enabled: setting?.value === 'true' || false,
    });
  } catch (error) {
    console.error('[Single Device Login Setting] Error:', error);
    return errorResponse("Failed to fetch setting", 500);
  }
}

// POST /api/admin/settings/single-device-login - Update single device login setting
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const user = session.user as { id: string; role: string };
  if (user.role !== "ADMIN") {
    return errorResponse("Access denied", 403);
  }

  try {
    const body = await req.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return errorResponse("Invalid input: enabled must be a boolean", 400);
    }

    await prisma.adminSetting.upsert({
      where: { key: 'single_device_login_enabled' },
      update: { value: enabled ? 'true' : 'false' },
      create: {
        key: 'single_device_login_enabled',
        value: enabled ? 'true' : 'false',
      },
    });

    console.log(`[Single Device Login Setting] Updated to: ${enabled}`);

    return jsonResponse({
      success: true,
      enabled,
    });
  } catch (error) {
    console.error('[Single Device Login Setting] Error:', error);
    return errorResponse("Failed to update setting", 500);
  }
}
