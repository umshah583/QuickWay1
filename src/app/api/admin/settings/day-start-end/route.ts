import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api-response";

const updateSchema = z.object({
  dayStartEndEnabled: z.boolean(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const userRole = (session.user as { role: string }).role;
  if (userRole !== 'ADMIN') {
    return errorResponse("Access denied", 403);
  }

  try {
    // Get the day start/end setting
    const setting = await prisma.settings.findUnique({
      where: { key: 'day_start_end_enabled' },
    });

    const dayStartEndEnabled = setting ? setting.value === 'true' : true; // Default to true if not set

    return jsonResponse({
      dayStartEndEnabled,
      setting: setting ? {
        id: setting.id,
        description: setting.description,
        updatedAt: setting.updatedAt,
      } : null,
    });
  } catch (error) {
    console.error('[Settings API] Error fetching day start/end setting:', error);
    return errorResponse("Failed to fetch setting", 500);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const userRole = (session.user as { role: string }).role;
  if (userRole !== 'ADMIN') {
    return errorResponse("Access denied", 403);
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid input", 400);
    }

    const { dayStartEndEnabled } = parsed.data;

    // Update or create the setting
    const setting = await prisma.settings.upsert({
      where: { key: 'day_start_end_enabled' },
      update: {
        value: dayStartEndEnabled.toString(),
        description: 'Controls whether drivers can start/end their work days',
      },
      create: {
        key: 'day_start_end_enabled',
        value: dayStartEndEnabled.toString(),
        description: 'Controls whether drivers can start/end their work days',
      } as any,
    });

    console.log(`[Settings API] Day start/end ${dayStartEndEnabled ? 'enabled' : 'disabled'} by admin ${session.user.id}`);

    return jsonResponse({
      success: true,
      dayStartEndEnabled,
      setting: {
        id: setting.id,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Settings API] Error updating day start/end setting:', error);
    return errorResponse("Failed to update setting", 500);
  }
}
