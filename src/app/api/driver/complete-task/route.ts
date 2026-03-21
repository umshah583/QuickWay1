import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { publishLiveUpdate } from "@/lib/liveUpdates";
import { notifyCustomerBookingUpdate } from "@/lib/notifications-v2";
import { emitBusinessEvent } from "@/lib/business-events";

const schema = z.object({
  bookingId: z.string(),
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

  const { bookingId } = parsed.data;

  // Verify booking ownership
  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { 
      id: true, 
      driverId: true,
      taskStatus: true,
      status: true,
      Payment: { select: { status: true } },
      cashCollected: true,
    },
  });

  if (!existingBooking) {
    console.log(`[Driver Complete Task] Booking ${bookingId} not found`);
    return errorResponse("Booking not found", 404);
  }

  if (existingBooking.driverId !== driverId) {
    console.log(`[Driver Complete Task] Booking ${bookingId} assigned to driver ${existingBooking.driverId}, but request from ${driverId}`);
    return errorResponse("Booking not assigned to this driver", 403);
  }

  // Check if task is in progress
  if (existingBooking.taskStatus !== "IN_PROGRESS") {
    console.log(`[Driver Complete Task] Booking ${bookingId} has taskStatus: ${existingBooking.taskStatus}, must be IN_PROGRESS to complete`);
    return errorResponse("Task must be in progress to complete", 400);
  }

  console.log(`[Driver Complete Task] Booking ${bookingId} status: taskStatus=${existingBooking.taskStatus}, status=${existingBooking.status}, cashCollected=${existingBooking.cashCollected}`);

  // Check if cash is collected for cash bookings
  if ((!existingBooking.Payment || existingBooking.Payment.status === "REQUIRES_PAYMENT") && !existingBooking.cashCollected) {
    console.log(`[Driver Complete Task] Booking ${bookingId} requires cash collection but cashCollected=${existingBooking.cashCollected}`);
    return errorResponse("Cannot complete task until cash is collected", 400);
  }

  // Update booking - set status to PAID when task is completed
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      taskStatus: "COMPLETED",
      status: "PAID",
      taskCompletedAt: new Date(),
    },
    select: {
      userId: true,
      endAt: true,
      Service: { select: { name: true } },
    },
  });

  // Emit centralized business event for task completed
  if (booking?.userId) {
    emitBusinessEvent('booking.completed', {
      bookingId,
      userId: booking.userId,
      driverId,
      serviceName: booking.Service?.name,
    });
  }

  // Broadcast booking update to admin AND the specific customer
  publishLiveUpdate(
    { type: 'bookings.updated', bookingId, userId: booking.userId },
    undefined // Broadcast to all - customer app will filter by userId
  );
  
  // Also send targeted update to the customer
  if (booking.userId) {
    publishLiveUpdate(
      { type: 'bookings.updated', bookingId, userId: booking.userId },
      { userIds: [booking.userId] }
    );
  }

  // Emit real-time system event for notification center
  const { emitBookingCompleted } = await import('@/lib/realtime-events');
  const driverInfo = await prisma.user.findUnique({
    where: { id: driverId },
    select: { name: true },
  });
  void emitBookingCompleted(
    bookingId,
    driverId,
    driverInfo?.name ?? 'Driver',
    booking.userId,
    booking.Service?.name ?? 'Service'
  );

  // Send FCM push notification to customer
  if (booking?.userId) {
    void notifyCustomerBookingUpdate(
      booking.userId,
      bookingId,
      'Service Completed',
      `Your ${booking.Service?.name ?? 'service'} has been completed. Thank you for choosing us!`
    );
  }

  return jsonResponse({ success: true, message: "Task completed successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
