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
  console.log(`[Driver Location] Driver ${driverId} sending location update:`, body);

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    console.log(`[Driver Location] Validation failed:`, parsed.error.issues);
    return errorResponse("Invalid input", 400);
  }

  const { bookingId, latitude, longitude } = parsed.data;
  console.log(`[Driver Location] Valid data - bookingId: ${bookingId}, lat: ${latitude}, lng: ${longitude}`);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, driverId: true, taskStatus: true },
  });

  if (!booking) {
    console.log(`[Driver Location] Booking ${bookingId} not found`);
    return errorResponse("Booking not found", 404);
  }

  if (booking.driverId !== driverId) {
    console.log(`[Driver Location] Booking ${bookingId} assigned to driver ${booking.driverId}, but request from ${driverId}`);
    return errorResponse("Booking not assigned to this driver", 403);
  }

  if (booking.taskStatus !== "IN_PROGRESS") {
    console.log(`[Driver Location] Booking ${bookingId} has taskStatus: ${booking.taskStatus}, location tracking requires IN_PROGRESS`);
    return errorResponse("Tracking is only allowed while task is in progress", 400);
  }

  console.log(`[Driver Location] Updating location for booking ${bookingId}`);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverLatitude: latitude,
      driverLongitude: longitude,
      driverLocationUpdatedAt: new Date(),
    },
  });

  console.log(`[Driver Location] Successfully updated location for booking ${bookingId}`);
  return jsonResponse({ success: true });
}

export function OPTIONS() {
  return noContentResponse();
}
