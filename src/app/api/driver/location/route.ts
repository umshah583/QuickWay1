import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { publishLiveUpdate } from "@/lib/liveUpdates";

export async function POST(req: Request) {
  const session = await getMobileUserFromRequest(req);
  if (!session || session.role !== "DRIVER") {
    return errorResponse("Unauthorized", 401);
  }

  const driverId = session.sub;
  const body = await req.json().catch(() => ({}));
  console.log(`[Driver Location] Driver ${driverId} sending location update:`, body);

  // Extract values, handling any type
  const latitude = typeof body?.latitude === 'number' ? body.latitude : null;
  const longitude = typeof body?.longitude === 'number' ? body.longitude : null;
  const bookingId = typeof body?.bookingId === 'string' ? body.bookingId : undefined;
  
  // Check if we have valid coordinates
  const hasValidCoordinates = latitude !== null && longitude !== null && 
                               Number.isFinite(latitude) && Number.isFinite(longitude);
  
  if (!hasValidCoordinates) {
    console.log(`[Driver Location] No valid coordinates provided (lat: ${latitude}, lng: ${longitude}), returning success`);
    return jsonResponse({ success: true, message: "No valid coordinates provided" });
  }
  
  console.log(`[Driver Location] Valid data - bookingId: ${bookingId || 'none'}, lat: ${latitude}, lng: ${longitude}`);

  // ALWAYS update driver's current location in User model (for admin tracking)
  await prisma.user.update({
    where: { id: driverId },
    data: {
      currentLatitude: latitude,
      currentLongitude: longitude,
      locationUpdatedAt: new Date(),
    },
  });
  console.log(`[Driver Location] Updated driver ${driverId} location in User model`);

  // If bookingId is provided, also update the booking (for customer tracking)
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, driverId: true, taskStatus: true },
    });

    if (!booking) {
      console.log(`[Driver Location] Booking ${bookingId} not found, but driver location saved`);
      // Still return success since we saved the driver location
      return jsonResponse({ success: true, message: "Driver location updated, booking not found" });
    }

    if (booking.driverId !== driverId) {
      console.log(`[Driver Location] Booking ${bookingId} assigned to driver ${booking.driverId}, but request from ${driverId}`);
      return jsonResponse({ success: true, message: "Driver location updated, booking not assigned to this driver" });
    }

    if (booking.taskStatus === "IN_PROGRESS") {
      console.log(`[Driver Location] Updating location for booking ${bookingId}`);

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          driverLatitude: latitude,
          driverLongitude: longitude,
          driverLocationUpdatedAt: new Date(),
        },
      });

      // Broadcast live location update to customer and admins
      try {
        const bookingWithCustomer = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { userId: true },
        });

        if (bookingWithCustomer) {
          publishLiveUpdate(
            {
              type: 'driver.location.updated',
              bookingId,
              driverId,
              latitude,
              longitude,
              timestamp: Date.now(),
            },
            {
              userIds: [bookingWithCustomer.userId],
              roles: ['ADMIN'],
            }
          );
          console.log(`[Driver Location] Live update broadcasted for booking ${bookingId}`);
        }
      } catch (error) {
        console.error('[Driver Location] Failed to broadcast live update:', error);
      }
    } else {
      console.log(`[Driver Location] Booking ${bookingId} taskStatus is ${booking.taskStatus}, skipping booking update`);
    }
  }

  // Broadcast driver location update to admins (for dashboard)
  try {
    publishLiveUpdate(
      {
        type: 'driver.location.updated',
        driverId,
        latitude,
        longitude,
        timestamp: Date.now(),
      },
      {
        roles: ['ADMIN'],
      }
    );
  } catch (error) {
    console.error('[Driver Location] Failed to broadcast admin update:', error);
  }

  console.log(`[Driver Location] Successfully updated location for driver ${driverId}`);
  return jsonResponse({ success: true });
}

export function OPTIONS() {
  return noContentResponse();
}
