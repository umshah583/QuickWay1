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
      payment: { select: { status: true } },
      cashCollected: true,
    },
  });

  if (!existingBooking || existingBooking.driverId !== driverId) {
    return errorResponse("Booking not assigned to this driver", 403);
  }

  // Check if cash is collected for cash bookings
  if ((!existingBooking.payment || existingBooking.payment.status === "REQUIRES_PAYMENT") && !existingBooking.cashCollected) {
    return errorResponse("Cannot complete task until cash is collected", 400);
  }

  // Update booking
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

  // Send notifications
  if (booking?.userId) {
    void sendPushNotificationToUser(booking.userId, {
      title: "Booking completed",
      body: `Your ${booking.service?.name ?? "service"} is complete. Thank you!`,
      url: "/account",
    });
  }

  void recordNotification({
    title: "Driver completed a task",
    message: `Driver marked ${booking?.service?.name ?? "a service"} as complete.`,
    category: NotificationCategory.DRIVER,
    entityType: "BOOKING",
    entityId: bookingId,
  });

  publishLiveUpdate({ 
    type: "bookings.updated", 
    bookingId, 
    userId: booking?.userId ?? undefined 
  }, {
    userIds: booking?.userId ? [booking.userId] : undefined
  });

  return jsonResponse({ success: true, message: "Task completed successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
