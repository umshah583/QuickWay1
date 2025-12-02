import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

const schema = z.object({
  bookingId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export async function POST(req: Request) {
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    return errorResponse("Unauthorized", 401);
  }

  const driverId = session.sub;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { bookingId, latitude, longitude } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, driverId: true, taskStatus: true },
  });

  if (!booking || booking.driverId !== driverId) {
    return errorResponse("Booking not assigned to this driver", 403);
  }

  if (booking.taskStatus !== "IN_PROGRESS") {
    return errorResponse("Tracking is only allowed while task is in progress", 400);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverLatitude: latitude,
      driverLongitude: longitude,
      driverLocationUpdatedAt: new Date(),
    },
  });

  return jsonResponse({ success: true });
}

export function OPTIONS() {
  return noContentResponse();
}
