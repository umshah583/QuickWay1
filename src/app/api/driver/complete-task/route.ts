import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { publishLiveUpdate } from "@/lib/liveUpdates";
// import { notifyCustomerBookingUpdate, sendToUser } from "@/lib/notifications-v2";
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
      payment: { select: { status: true } },
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
  if ((!existingBooking.payment || existingBooking.payment.status === "REQUIRES_PAYMENT") && !existingBooking.cashCollected) {
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
      service: { select: { name: true } },
    },
  });

  // Emit centralized business event for task completed
  if (booking?.userId) {
    emitBusinessEvent('booking.completed', {
      bookingId,
      userId: booking.userId,
      driverId,
      serviceName: booking.service?.name,
    });
  }

  // Broadcast to ALL clients (admin dashboard refresh)
  publishLiveUpdate(
    { type: 'bookings.updated', bookingId },
    undefined // No target = broadcast to all
  );

  return jsonResponse({ success: true, message: "Task completed successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
