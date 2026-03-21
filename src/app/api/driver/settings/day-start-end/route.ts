import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    return errorResponse("Unauthorized", 401);
  }

  try {
    // Get the day start/end setting
    const setting = await prisma.settings.findUnique({
      where: { key: 'day_start_end_enabled' },
    });

    const dayStartEndEnabled = setting ? setting.value === 'true' : true; // Default to true if not set

    return jsonResponse({
      dayStartEndEnabled,
    });
  } catch (error) {
    console.error('[Driver Settings API] Error fetching day start/end setting:', error);
    return errorResponse("Failed to fetch setting", 500);
  }
}
