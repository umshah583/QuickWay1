import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import stripe from "@/lib/stripe";
import type { BookingStatus, Prisma, PaymentProvider, PaymentStatus } from "@prisma/client";
import { calculateBookingPricing, PricingError, CouponError } from "@/lib/booking-pricing";
import { startOfDay } from "date-fns";
// NOTE: Legacy publishLiveUpdate removed - customer booking creation uses notifications-v2

const bookingSchema = z.object({
  serviceId: z.string().min(1, "Select a service"),
  startAt: z.string().min(1, "Select a start time"),
  locationLabel: z.string().trim().max(120).optional(),
  locationCoordinates: z.string().trim().max(256).optional(),
  vehicleMake: z.string().trim().max(60).optional(),
  vehicleModel: z.string().trim().max(60).optional(),
  vehicleColor: z.string().trim().max(60).optional(),
  vehicleType: z.string().trim().max(60).optional(),
  vehiclePlate: z.string().trim().max(32).optional(),
  vehicleServiceDetails: z.string().trim().max(1024).optional(),
  paymentMethod: z.enum(["cash", "card"]).optional(),
  paymentIntentId: z.string().trim().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  couponCode: z.string().trim().max(64).nullable().optional(),
  vehicleCount: z.number().int().min(1).optional(),
  customerLatitude: z.number().optional(),
  customerLongitude: z.number().optional(),
});

const bookingStatusSchema = z.enum(["PENDING", "PAID", "CANCELLED"]);

export async function POST(req: Request) {
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

  const resolvedUserId = userId;

  const body = await req.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return errorResponse(message, 400);
  }
  const {
    serviceId,
    startAt,
    locationLabel,
    locationCoordinates,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehicleType,
    vehiclePlate,
    vehicleServiceDetails,
    paymentMethod: rawPaymentMethod,
    paymentIntentId,
    loyaltyPoints,
    couponCode,
    vehicleCount,
    customerLatitude,
    customerLongitude,
  } = parsed.data;
  const paymentMethod = rawPaymentMethod ?? "cash";
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return errorResponse("Invalid service", 400);
  }
  const start = new Date(startAt);
  if (isNaN(start.getTime())) {
    return errorResponse("Invalid date", 400);
  }

  // Check if business day is open
  const today = new Date();
  const startOfToday = startOfDay(today);

  // Check if we're within business hours
  const activeBusinessHours = await prisma.businessHours.findFirst({
    where: { isActive: true }
  });

  let adjustedStart = start;
  let adjustedEnd = new Date(start.getTime() + service.durationMin * 60000);

  // If business hours are set and booking is outside hours, schedule for next business day
  if (activeBusinessHours) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
    const startMinutes = parseInt(activeBusinessHours.startTime.split(':')[0]) * 60 + parseInt(activeBusinessHours.startTime.split(':')[1]);
    const endMinutes = parseInt(activeBusinessHours.endTime.split(':')[0]) * 60 + parseInt(activeBusinessHours.endTime.split(':')[1]);

    // If current time is before business hours start or after business hours end
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      // Schedule for next business day at the same time
      const nextBusinessDay = new Date(startOfToday);
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);

      // Calculate time difference from start of day
      const bookingTimeMinutes = start.getHours() * 60 + start.getMinutes();
      const nextDayStart = new Date(nextBusinessDay);
      nextDayStart.setHours(Math.floor(bookingTimeMinutes / 60), bookingTimeMinutes % 60, 0, 0);

      adjustedStart = nextDayStart;
      adjustedEnd = new Date(adjustedStart.getTime() + service.durationMin * 60000);
    }
  }

  const overlap = await prisma.booking.findFirst({
    where: {
      serviceId,
      status: { in: ["PENDING", "PAID"] },
      startAt: { lt: adjustedEnd },
      endAt: { gt: adjustedStart },
    },
  });
  if (overlap) {
    return errorResponse("Selected slot is not available", 409);
  }

  let loyaltyPointsApplied = 0;
  let loyaltyCreditAppliedCents = 0;
  let loyaltyRemainingPoints: number | null = null;
  let finalAmountCents = 0;
  let pricingCouponCode: string | null = null;
  let pricingCouponId: string | null = null;
  let pricingCouponDiscountCents = 0;
  // Pricing snapshots to lock in values at booking time
  let snapshotServicePriceCents: number | null = null;
  let snapshotServiceDiscountPercentage: number | null = null;
  let snapshotTaxPercentage: number | null = null;
  let snapshotStripeFeePercentage: number | null = null;
  let snapshotExtraFeeCents: number | null = null;

  // Calculate pricing (with or without loyalty points) to get final amount including all discounts and fees
  try {
    console.log("[bookings] Requested loyalty points:", loyaltyPoints, "coupon:", couponCode);
    const effectiveVehicleCount = vehicleCount && Number.isFinite(vehicleCount) && vehicleCount > 0
      ? Math.floor(vehicleCount)
      : 1;
    const pricing = await calculateBookingPricing({
      userId: resolvedUserId,
      serviceId,
      couponCode,
      loyaltyPoints: loyaltyPoints ?? 0,
      bookingId: null,
      vehicleCount: effectiveVehicleCount,
    });
    loyaltyPointsApplied = pricing.loyaltyPointsApplied;
    loyaltyCreditAppliedCents = pricing.loyaltyCreditAppliedCents;
    loyaltyRemainingPoints = pricing.remainingPoints;
    finalAmountCents = pricing.finalAmountCents;
    pricingCouponCode = pricing.couponCode;
    pricingCouponId = pricing.couponId;
    pricingCouponDiscountCents = pricing.couponDiscountCents;
    // Capture pricing snapshots to lock in values at booking time
    snapshotServicePriceCents = pricing.servicePriceCents;
    snapshotServiceDiscountPercentage = pricing.serviceDiscountPercentage;
    snapshotTaxPercentage = pricing.taxPercentage;
    snapshotStripeFeePercentage = pricing.stripeFeePercentage;
    snapshotExtraFeeCents = pricing.extraFeeCents;
    console.log("[bookings] Loyalty points applied:", loyaltyPointsApplied, "Credit:", loyaltyCreditAppliedCents);
    console.log("[bookings] Pricing snapshots:", { snapshotServicePriceCents, snapshotServiceDiscountPercentage, snapshotTaxPercentage, snapshotStripeFeePercentage, snapshotExtraFeeCents });
  } catch (error) {
    if (error instanceof PricingError || error instanceof CouponError) {
      return errorResponse(error.message, error.status);
    }
    console.error("[bookings] pricing calculation error", error);
    return errorResponse("Unable to calculate pricing", 500);
  }

  const effectiveVehicleCountForPersist = vehicleCount && Number.isFinite(vehicleCount) && vehicleCount > 0
    ? Math.floor(vehicleCount)
    : 1;
  const booking = await prisma.booking.create({
    data: {
      userId: resolvedUserId,
      serviceId,
      startAt: adjustedStart,
      endAt: adjustedEnd,
      status: "PENDING",
      locationLabel: locationLabel ?? null,
      locationCoordinates: locationCoordinates ?? null,
      customerLatitude: typeof customerLatitude === "number" && Number.isFinite(customerLatitude) ? customerLatitude : null,
      customerLongitude: typeof customerLongitude === "number" && Number.isFinite(customerLongitude) ? customerLongitude : null,
      vehicleMake: vehicleMake ?? null,
      vehicleModel: vehicleModel ?? null,
      vehicleColor: vehicleColor ?? null,
      vehicleType: vehicleType ?? null,
      vehiclePlate: vehiclePlate ?? null,
      vehicleServiceDetails: vehicleServiceDetails ?? null,
      vehicleCount: effectiveVehicleCountForPersist,
      couponCode: pricingCouponCode,
      couponId: pricingCouponId ?? undefined,
      couponDiscountCents: pricingCouponDiscountCents,
      loyaltyPointsApplied,
      loyaltyCreditAppliedCents,
      cashAmountCents: paymentMethod === "cash" ? finalAmountCents : null,
      // Pricing snapshots - locked at booking creation time (won't change if admin updates settings)
      servicePriceCents: snapshotServicePriceCents,
      serviceDiscountPercentage: snapshotServiceDiscountPercentage,
      taxPercentage: snapshotTaxPercentage,
      stripeFeePercentage: snapshotStripeFeePercentage,
      extraFeeCents: snapshotExtraFeeCents,
    },
  });

  let loyaltyDeducted = false;
  async function revertLoyaltyDeduction() {
    if (!loyaltyDeducted || loyaltyPointsApplied <= 0) {
      return;
    }
    try {
      const current = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { loyaltyRedeemedPoints: true },
      });
      const next = Math.max(0, (current?.loyaltyRedeemedPoints ?? 0) - loyaltyPointsApplied);
      await prisma.user.update({
        where: { id: resolvedUserId },
        data: {
          loyaltyRedeemedPoints: next,
        },
      });
      loyaltyDeducted = false;
    } catch (error) {
      console.error("[bookings] Failed to revert loyalty deduction", error);
    }
  }

  if (loyaltyPointsApplied > 0) {
    try {
      console.log("[bookings] Incrementing loyaltyRedeemedPoints by", loyaltyPointsApplied, "for user", resolvedUserId);
      const current = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { loyaltyRedeemedPoints: true },
      });
      const next = (current?.loyaltyRedeemedPoints ?? 0) + loyaltyPointsApplied;
      await prisma.user.update({
        where: { id: resolvedUserId },
        data: {
          loyaltyRedeemedPoints: next,
        },
      });
      loyaltyDeducted = true;
      console.log("[bookings] Successfully incremented loyaltyRedeemedPoints");
    } catch (error) {
      console.error("[bookings] Failed to deduct loyalty points", error);
      await prisma.booking.delete({ where: { id: booking.id } });
      return errorResponse("Unable to apply loyalty points", 500);
    }
  }

  if (paymentMethod === "card") {
    if (!paymentIntentId) {
      return jsonResponse(
        {
          id: booking.id,
          requiresPayment: true,
          status: booking.status,
          loyaltyPointsApplied,
          loyaltyCreditAppliedCents,
          loyaltyRemainingPoints,
        },
        { status: 202 },
      );
    }

    if (!stripe) {
      await prisma.booking.delete({ where: { id: booking.id } });
      await revertLoyaltyDeduction();
      return errorResponse("Unable to process payment. Please try again later.", 500);
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") {
        await prisma.booking.delete({ where: { id: booking.id } });
        await revertLoyaltyDeduction();
        return errorResponse("Your booking failed due to payment issue.", 400);
      }

      await prisma.booking.update({ where: { id: booking.id }, data: { status: "PAID" } });

      await prisma.payment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          provider: "STRIPE" as PaymentProvider,
          status: "PAID" as PaymentStatus,
          amountCents: intent.amount ?? 0,
          sessionId: intent.id,
        },
        update: {
          status: "PAID" as PaymentStatus,
          amountCents: intent.amount ?? 0,
          sessionId: intent.id,
        },
      });
    } catch {
      await prisma.booking.delete({ where: { id: booking.id } });
      await revertLoyaltyDeduction();
      return errorResponse("Your booking failed due to payment issue.", 400);
    }
  }

  // Send booking confirmation to CUSTOMER using notifications-v2
  const { notifyCustomerBookingUpdate } = await import('@/lib/notifications-v2');
  void notifyCustomerBookingUpdate(
    resolvedUserId,
    booking.id,
    'Booking Created',
    'Your booking has been created successfully.'
  );

  return jsonResponse(
    {
      id: booking.id,
      requiresPayment: false,
      status: booking.status,
      loyaltyPointsApplied,
      loyaltyCreditAppliedCents,
      loyaltyRemainingPoints,
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
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

  const url = new URL(req.url ?? "http://localhost");
  const statusParam = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  let statusFilter: BookingStatus | undefined;
  if (statusParam) {
    const parsedStatus = bookingStatusSchema.safeParse(statusParam.toUpperCase());
    if (!parsedStatus.success) {
      return errorResponse("Invalid status filter", 400);
    }
    statusFilter = parsedStatus.data;
  }

  const where: Prisma.BookingWhereInput = {
    userId,
  };
  if (statusFilter) {
    where.status = statusFilter;
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startAt: "desc" },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      service: true,
      payment: true,
    },
  });

  // Enrich with distanceMeters and etaMinutes when GPS and in-progress task are available
  const AVG_SPEED_KMH = 30; // configurable average speed for ETA
  const enriched = bookings.map((booking) => {
    let distanceMeters: number | undefined;
    let etaMinutes: number | undefined;

    if (
      booking.taskStatus === "IN_PROGRESS" &&
      typeof booking.customerLatitude === "number" &&
      typeof booking.customerLongitude === "number" &&
      typeof booking.driverLatitude === "number" &&
      typeof booking.driverLongitude === "number"
    ) {
      console.log(`[ETA] Calculating for booking ${booking.id}:`, {
        customerLat: booking.customerLatitude,
        customerLon: booking.customerLongitude,
        driverLat: booking.driverLatitude,
        driverLon: booking.driverLongitude,
      });
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371000; // meters
      const φ1 = toRad(booking.customerLatitude);
      const φ2 = toRad(booking.driverLatitude);
      const Δφ = toRad(booking.driverLatitude - booking.customerLatitude);
      const Δλ = toRad(booking.driverLongitude - booking.customerLongitude);

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceMeters = R * c;

      const distanceKm = distanceMeters / 1000;
      if (AVG_SPEED_KMH > 0) {
        etaMinutes = Math.max(0, Math.round((distanceKm / AVG_SPEED_KMH) * 60));
      }
      
      console.log(`[ETA] Calculated for booking ${booking.id}:`, {
        distanceMeters,
        distanceKm,
        etaMinutes,
      });
    } else if (booking.taskStatus === "IN_PROGRESS") {
      console.log(`[ETA] Cannot calculate for booking ${booking.id} - missing GPS data:`, {
        taskStatus: booking.taskStatus,
        hasCustomerLat: typeof booking.customerLatitude === "number",
        hasCustomerLon: typeof booking.customerLongitude === "number",
        hasDriverLat: typeof booking.driverLatitude === "number",
        hasDriverLon: typeof booking.driverLongitude === "number",
      });
    }

    return {
      ...booking,
      distanceMeters,
      etaMinutes,
    };
  });

  let nextCursor: string | null = null;
  if (enriched.length > take) {
    const nextItem = enriched.pop();
    nextCursor = nextItem?.id ?? null;
  }

  return jsonResponse({ data: enriched, nextCursor });
}

export function OPTIONS() {
  return noContentResponse();
}
