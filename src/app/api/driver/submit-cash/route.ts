import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { PaymentProvider, PaymentStatus, BookingStatus } from "@prisma/client";
import { publishLiveUpdate } from "@/lib/liveUpdates";
// import { notifyCustomerBookingUpdate, sendToUser } from "@/lib/notifications-v2";
import { emitBusinessEvent } from "@/lib/business-events";

const schema = z.object({
  bookingId: z.string(),
  cashCollected: z.boolean(),
  cashAmount: z.number().optional(),
  driverNotes: z.string().optional(),
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
    return errorResponse("Invalid input", 400);
  }

  const { bookingId, cashCollected, cashAmount, driverNotes } = parsed.data;

  // Verify booking ownership
  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      driverId: true,
      cashAmountCents: true,
      service: { select: { priceCents: true } },
    },
  });

  if (!existingBooking || existingBooking.driverId !== driverId) {
    return errorResponse("Booking not assigned to this driver", 403);
  }

  const fallbackAmountCents =
    existingBooking.cashAmountCents && existingBooking.cashAmountCents > 0
      ? existingBooking.cashAmountCents
      : existingBooking.service?.priceCents ?? null;

  if (!fallbackAmountCents) {
    return errorResponse("Unable to determine booking amount", 400);
  }

  // Calculate cash amount in cents
  const cashAmountCents = typeof cashAmount === "number"
    ? Math.round(cashAmount * 100)
    : fallbackAmountCents;

  // Transaction to update Booking and Payment records synchronously
  const [booking] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        cashCollected,
        cashAmountCents: cashCollected ? cashAmountCents : null,
        cashSettled: false,
        driverNotes: driverNotes || null,
        // If collected -> PAID. If reverted -> PENDING (awaiting payment)
        status: cashCollected ? BookingStatus.PAID : BookingStatus.PENDING,
      },
      select: {
        userId: true,
        service: { select: { name: true } },
      },
    }),
    // Handle Payment record
    cashCollected
      ? prisma.payment.upsert({
          where: { bookingId },
          create: {
            bookingId,
            provider: PaymentProvider.CASH,
            status: PaymentStatus.PAID,
            amountCents: cashAmountCents,
          },
          update: {
            provider: PaymentProvider.CASH,
            status: PaymentStatus.PAID,
            amountCents: cashAmountCents,
          },
        })
      : prisma.payment.deleteMany({
          where: { bookingId },
        }),
  ]);

  // Emit centralized business event for cash collected
  if (cashCollected && booking?.userId) {
    emitBusinessEvent('booking.cash_collected', {
      bookingId,
      userId: booking.userId,
      driverId,
      amount: cashAmountCents / 100,
      serviceName: booking.service?.name,
    });
  }

  // Broadcast to ALL clients (admin dashboard refresh)
  publishLiveUpdate(
    { type: 'bookings.updated', bookingId },
    undefined // No target = broadcast to all
  );

  return jsonResponse({ success: true, message: "Cash details saved successfully" });
}

export function OPTIONS() {
  return noContentResponse();
}
