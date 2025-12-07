import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { sendPushNotificationToUser } from "@/lib/push";
import { recordNotification } from "@/lib/admin-notifications";
import { publishLiveUpdate } from "@/lib/liveUpdates";
import { NotificationCategory } from "@prisma/client";

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
    console.log(`[Driver Start Task] Validation failed for driver ${driverId}:`, parsed.error.issues);
    return errorResponse("Missing bookingId", 400);
  }

  const { bookingId, latitude, longitude } = parsed.data;
  console.log(`[Driver Start Task] Driver ${driverId} attempting to start booking ${bookingId}`);

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

  console.log(`[Driver Start Task] Starting booking ${bookingId}`);

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

  console.log(`[Driver Start Task] Successfully started booking ${bookingId}`);

  // Send notifications
  if (booking?.userId) {
    void sendPushNotificationToUser(booking.userId, {
      title: "Booking in progress",
      body: `Your ${booking.service?.name ?? "service"} has started.`,
      url: "/account",
    });
  }

  void recordNotification({
    title: "Driver started a task",
    message: `Driver began ${booking?.service?.name ?? "a service"} scheduled for ${booking?.startAt?.toLocaleString() ?? ""}.`,
    category: NotificationCategory.DRIVER,
    entityType: "BOOKING",
    entityId: bookingId,
  });

  if (booking?.userId) {
    publishLiveUpdate({ type: "bookings.updated", bookingId, userId: booking.userId });
  }
  publishLiveUpdate({ type: "bookings.updated", bookingId });

  return jsonResponse({ success: true, message: "Task started successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
