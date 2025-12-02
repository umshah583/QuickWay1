import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  bookingId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

// Debug endpoint to manually set driver location
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { bookingId, latitude, longitude } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, taskStatus: true },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverLatitude: latitude,
      driverLongitude: longitude,
      driverLocationUpdatedAt: new Date(),
    },
  });

  return jsonResponse({
    success: true,
    message: "Driver location updated",
    bookingId,
    latitude,
    longitude,
  });
}
