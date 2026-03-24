import { z } from "zod";
import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { PaymentProvider, PaymentStatus, BookingStatus } from "@prisma/client";
import { publishLiveUpdate } from "@/lib/liveUpdates";
import { notifyCustomerBookingUpdate } from "@/lib/notifications-v2";
import { emitBusinessEvent } from "@/lib/business-events";

const schema = z.object({
  bookingId: z.string(),
  cashCollected: z.boolean(),
  cashAmount: z.number().optional(),
  driverNotes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    console.log('[Submit Cash] Starting request...');
    
    const session = await getMobileUserFromRequest(req);
    if (!session || session.role !== "DRIVER") {
      console.log('[Submit Cash] Unauthorized - session:', session, 'role:', session?.role);
      return errorResponse("Unauthorized", 401);
    }

    const driverId = session.sub;
    console.log('[Submit Cash] Driver ID:', driverId);
    
    const body = await req.json().catch((error) => {
      console.log('[Submit Cash] Failed to parse JSON:', error);
      return null;
    });
    console.log('[Submit Cash] Request body:', body);
    
    const parsed = schema.safeParse(body);
    console.log('[Submit Cash] Schema validation result:', parsed.success, parsed.error);
    
    if (!parsed.success) {
      return errorResponse("Invalid input", 400);
    }

    const { bookingId, cashCollected, cashAmount, driverNotes } = parsed.data;
    console.log('[Submit Cash] Parsed data:', { bookingId, cashCollected, cashAmount, driverNotes });

  // Verify booking ownership
  console.log('[Submit Cash] Checking booking ownership for bookingId:', bookingId);
  const existingBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      driverId: true,
      cashAmountCents: true,
      Service: { select: { priceCents: true } },
    },
  });

  console.log('[Submit Cash] Found booking:', existingBooking);
  console.log('[Submit Cash] Booking driverId:', existingBooking?.driverId);
  console.log('[Submit Cash] Current driverId:', driverId);
  console.log('[Submit Cash] Driver match:', existingBooking?.driverId === driverId);

  if (!existingBooking || existingBooking.driverId !== driverId) {
    console.log('[Submit Cash] Booking ownership check failed');
    return errorResponse("Booking not assigned to this driver", 403);
  }

  const fallbackAmountCents =
    existingBooking.cashAmountCents && existingBooking.cashAmountCents > 0
      ? existingBooking.cashAmountCents
      : existingBooking.Service?.priceCents ?? null;

  if (!fallbackAmountCents) {
    console.log('[Submit Cash] Unable to determine booking amount, fallbackAmountCents:', fallbackAmountCents);
    return errorResponse("Unable to determine booking amount", 400);
  }

  // Calculate cash amount in cents
  const cashAmountCents = typeof cashAmount === "number"
    ? Math.round(cashAmount * 100)
    : fallbackAmountCents;

  console.log('[Submit Cash] About to start database transaction...');
  console.log('[Submit Cash] Transaction data:', { cashCollected, cashAmountCents, driverNotes });

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
        Service: { select: { name: true } },
      },
    }),
    // Handle Payment record
    cashCollected
      ? prisma.payment.upsert({
          where: { bookingId },
          create: {
            id: `pay-${bookingId}-${Date.now()}`, // Generate unique payment ID
            bookingId,
            provider: PaymentProvider.CASH,
            status: PaymentStatus.PAID,
            amountCents: cashAmountCents,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
          update: {
            provider: PaymentProvider.CASH,
            status: PaymentStatus.PAID,
            amountCents: cashAmountCents,
            updatedAt: new Date(),
          },
        })
      : prisma.payment.deleteMany({
          where: { bookingId },
        }),
  ]);

    console.log('[Submit Cash] Transaction completed successfully');
    console.log('[Submit Cash] Updated booking:', booking);

  // Emit centralized business event for cash collected
  if (cashCollected && booking?.userId) {
    emitBusinessEvent('booking.cash_collected', {
      bookingId,
      userId: booking.userId,
      driverId,
      amount: cashAmountCents / 100,
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

  // Send FCM push notification to customer
  if (cashCollected && booking?.userId) {
    void notifyCustomerBookingUpdate(
      booking.userId,
      bookingId,
      'Payment Received',
      `Cash payment received for your ${booking.Service?.name ?? 'service'}. Thank you!`
    );
  }

  return jsonResponse({ success: true, message: "Cash details saved successfully" });
  } catch (error: any) {
    console.error('[Submit Cash] Error:', error);
    console.error('[Submit Cash] Error message:', error?.message);
    console.error('[Submit Cash] Error stack:', error?.stack);
    console.error('[Submit Cash] Error details:', JSON.stringify(error, null, 2));
    return errorResponse("Internal server error", 500);
  }
}

export function OPTIONS() {
  return noContentResponse();
}
