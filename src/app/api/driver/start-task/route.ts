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
    select: { id: true, driverId: true },
  });

  if (!existingBooking || existingBooking.driverId !== driverId) {
    return errorResponse("Booking not assigned to this driver", 403);
  }

  // Update booking
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      taskStatus: "IN_PROGRESS",
      status: "ASSIGNED",
      taskStartedAt: new Date(),
    },
    select: {
      userId: true,
      startAt: true,
      service: { select: { name: true } },
    },
  });

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
