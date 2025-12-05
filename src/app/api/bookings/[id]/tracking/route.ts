import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { errorResponse, jsonResponse } from "@/lib/api-response";

function calculateDistanceMeters(
  customerLat: number,
  customerLon: number,
  driverLat: number,
  driverLon: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const φ1 = toRad(customerLat);
  const φ2 = toRad(driverLat);
  const Δφ = toRad(driverLat - customerLat);
  const Δλ = toRad(driverLon - customerLon);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(
  req: Request,
  context: { params: { id: string } },
) {
  const bookingId = context.params?.id;
  if (!bookingId) {
    return errorResponse("Booking id is required", 400);
  }

  const mobileUser = await getMobileUserFromRequest(req);
  let userId: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id: string }).id;
  }

  if (!userId) {
    return errorResponse("Unauthorized", 401);
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      id: true,
      status: true,
      taskStatus: true,
      customerLatitude: true,
      customerLongitude: true,
      driverLatitude: true,
      driverLongitude: true,
      startAt: true,
    },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  const AVG_SPEED_KMH = 30;
  let distanceMeters: number | null = null;
  let etaMinutes: number | null = null;

  if (
    booking.taskStatus === "IN_PROGRESS" &&
    typeof booking.customerLatitude === "number" &&
    typeof booking.customerLongitude === "number" &&
    typeof booking.driverLatitude === "number" &&
    typeof booking.driverLongitude === "number"
  ) {
    distanceMeters = calculateDistanceMeters(
      booking.customerLatitude,
      booking.customerLongitude,
      booking.driverLatitude,
      booking.driverLongitude,
    );

    const distanceKm = distanceMeters / 1000;
    if (AVG_SPEED_KMH > 0) {
      etaMinutes = Math.max(0, Math.round((distanceKm / AVG_SPEED_KMH) * 60));
    }
  }

  return jsonResponse({
    id: booking.id,
    status: booking.status,
    taskStatus: booking.taskStatus,
    customerLatitude: booking.customerLatitude,
    customerLongitude: booking.customerLongitude,
    driverLatitude: booking.driverLatitude,
    driverLongitude: booking.driverLongitude,
    distanceMeters,
    etaMinutes,
    startAt: booking.startAt,
  });
}
