import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { recordNotification } from "@/lib/admin-notifications";
import { NotificationCategory } from "@prisma/client";
import { publishLiveUpdate } from "@/lib/liveUpdates";
import { notifyCustomerBookingUpdate, sendToUser } from "@/lib/notifications-v2";

const schema = z.object({
  bookingId: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
    return errorResponse("Missing bookingId", 400);
  }

  const { bookingId, latitude, longitude } = parsed.data;

  // Verify booking ownership
  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, driverId: true, taskStatus: true, status: true },
  });

  if (!existingBooking) {
    console.log(`[Driver Start Task] Booking ${bookingId} not found`);
    return errorResponse("Booking not found", 404);
  }

  if (existingBooking.driverId !== driverId) {
    console.log(`[Driver Start Task] Booking ${bookingId} assigned to driver ${existingBooking.driverId}, but request from ${driverId}`);
    return errorResponse("Booking not assigned to this driver", 403);
  }

  // Check if task can be started
  if (existingBooking.taskStatus !== "ASSIGNED") {
    console.log(`[Driver Start Task] Booking ${bookingId} has taskStatus: ${existingBooking.taskStatus}, must be ASSIGNED to start`);
    return errorResponse("Task must be assigned to start", 400);
  }

  console.log(`[Driver Start Task] Booking ${bookingId} current status: taskStatus=${existingBooking.taskStatus}, status=${existingBooking.status}`);

  // Prepare update data
  const updateData: {
    taskStatus: "IN_PROGRESS";
    status: "ASSIGNED";
    taskStartedAt: Date;
    driverLatitude?: number;
    driverLongitude?: number;
    driverLocationUpdatedAt?: Date;
  } = {
    taskStatus: "IN_PROGRESS",
    status: "ASSIGNED",
    taskStartedAt: new Date(),
  };

  // Set initial driver location if provided
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    updateData.driverLatitude = latitude;
    updateData.driverLongitude = longitude;
    updateData.driverLocationUpdatedAt = new Date();
  }

  // Update booking
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: updateData,
    select: {
      userId: true,
      startAt: true,
      service: { select: { name: true } },
    },
  });

  // Notify CUSTOMER that service has started
  if (booking?.userId) {
    // Real-time WebSocket update to customer
    publishLiveUpdate(
      { type: 'bookings.updated', bookingId, userId: booking.userId },
      { userIds: [booking.userId] }
    );
    
    // Real-time WebSocket update to driver
    publishLiveUpdate(
      { type: 'generic', payload: { event: 'driver.started', bookingId } },
      { userIds: [driverId] }
    );

    void notifyCustomerBookingUpdate(
      booking.userId,
      bookingId,
      'Service Started',
      `Your ${booking.service?.name ?? 'service'} has started. The driver is now working on your vehicle.`
    );
  }
  
  // Send task started notification to DRIVER
  void sendToUser(driverId, 'DRIVER', {
    title: 'Task Started',
    body: 'You have successfully started the assigned task. Safe driving!',
    category: 'DRIVER',
    entityType: 'booking',
    entityId: bookingId,
  });
  
  // Admin dashboard refresh is handled by Next.js data revalidation

  return jsonResponse({ success: true, message: "Task started successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
