import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateBookingPricing, PricingError, CouponError } from "@/lib/booking-pricing";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import stripe from "@/lib/stripe";
import type { BookingStatus, Prisma, PaymentProvider, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { generateBookingIdentifiers } from "@/lib/booking-identifiers";

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
  paymentMethod: z.enum(["cash", "card", "apple_pay", "google_pay", "wallet"]).optional(),
  paymentIntentId: z.string().trim().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  couponCode: z.string().trim().max(64).nullable().optional(),
  vehicleCount: z.number().int().min(1).optional(),
  customerLatitude: z.number().optional(),
  customerLongitude: z.number().optional(),
});

const bookingStatusSchema = z.enum(["PENDING", "PAID", "CANCELLED"]);

export async function POST(req: Request) {
  try {
    console.log("[bookings] POST request received");
    
    const mobileUser = await getMobileUserFromRequest(req);
    let userId: string | null = null;

    if (mobileUser) {
      userId = mobileUser.sub;
      console.log("[bookings] Using mobile user:", userId);
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        console.log("[bookings] No session found");
        return errorResponse("Unauthorized", 401);
      }
      userId = (session.user as { id: string }).id;
      console.log("[bookings] Using session user:", userId);
    }

    if (!userId) {
      console.log("[bookings] No user ID found");
      return errorResponse("Unauthorized", 401);
    }

  const resolvedUserId = userId;
  console.log("[bookings] Resolved user ID:", resolvedUserId);

  const body = await req.json().catch(() => null);
  console.log("[bookings] Request body:", body);
  
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    console.log("[bookings] Validation error:", message);
    return errorResponse(message, 400);
  }
  console.log("[bookings] Parsed data successfully");
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
  console.log("[bookings] Looking up service:", serviceId);
  
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    console.log("[bookings] Invalid service:", service);
    return errorResponse("Invalid service", 400);
  }
  console.log("[bookings] Found service:", service.name);
  
  const start = new Date(startAt);
  if (isNaN(start.getTime())) {
    console.log("[bookings] Invalid date:", startAt);
    return errorResponse("Invalid date", 400);
  }

  // Check if business day is open
  const requestedStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  // Check if we're within business hours
  const activeBusinessHours = await prisma.businessHours.findFirst({
    where: { isActive: true }
  });

  let adjustedStart = start;
  let adjustedEnd = new Date(start.getTime() + service.durationMin * 60000);

  // If business hours are set and booking is outside hours, schedule for next business day
  if (activeBusinessHours) {
    const bookingMinutes = start.getHours() * 60 + start.getMinutes();
    const startMinutes = parseInt(activeBusinessHours.startTime.split(':')[0]) * 60 + parseInt(activeBusinessHours.startTime.split(':')[1]);
    const endMinutes = parseInt(activeBusinessHours.endTime.split(':')[0]) * 60 + parseInt(activeBusinessHours.endTime.split(':')[1]);

    // If selected slot is outside operating window, push to next business day at same clock time
    if (bookingMinutes < startMinutes || bookingMinutes > endMinutes) {
      const nextBusinessDay = new Date(requestedStartDay);
      nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);

      // Calculate time difference from start of day
      const nextDayStart = new Date(nextBusinessDay);
      nextDayStart.setHours(Math.floor(bookingMinutes / 60), bookingMinutes % 60, 0, 0);

      adjustedStart = nextDayStart;
      adjustedEnd = new Date(adjustedStart.getTime() + service.durationMin * 60000);
    }
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
  // Area-based pricing snapshot
  let snapshotAreaId: string | null = null;
  let snapshotAreaName: string | null = null;

  // Calculate pricing (with or without loyalty points) to get final amount including all discounts and fees
  try {
    console.log("[bookings] Starting pricing calculation");
    console.log("[bookings] Requested loyalty points:", loyaltyPoints, "coupon:", couponCode);
    const effectiveVehicleCount = vehicleCount && Number.isFinite(vehicleCount) && vehicleCount > 0
      ? Math.floor(vehicleCount)
      : 1;
    console.log("[bookings] Effective vehicle count:", effectiveVehicleCount);
    
    const pricing = await calculateBookingPricing({
      userId: resolvedUserId,
      serviceId,
      couponCode,
      loyaltyPoints: loyaltyPoints ?? 0,
      bookingId: null,
      vehicleCount: effectiveVehicleCount,
      // Pass customer coordinates for area-based pricing
      latitude: customerLatitude ?? null,
      longitude: customerLongitude ?? null,
    });
    console.log("[bookings] Pricing calculation successful");
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
    // Capture area info
    snapshotAreaId = pricing.areaId;
    snapshotAreaName = pricing.areaName;
    console.log("[bookings] Loyalty points applied:", loyaltyPointsApplied, "Credit:", loyaltyCreditAppliedCents);
    console.log("[bookings] Pricing snapshots:", { snapshotServicePriceCents, snapshotServiceDiscountPercentage, snapshotTaxPercentage, snapshotStripeFeePercentage, snapshotExtraFeeCents });
    console.log("[bookings] Area pricing:", { snapshotAreaId, snapshotAreaName });
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

  // Generate invoice and order numbers
  const { invoiceNumber, orderNumber } = await generateBookingIdentifiers(snapshotAreaName);
  console.log("[bookings] Generated identifiers:", { invoiceNumber, orderNumber });

  console.log("[bookings] Creating booking...");
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
      // Area-based pricing snapshot
      areaId: snapshotAreaId,
      areaName: snapshotAreaName,
    } as any,
  });
  console.log("[bookings] Booking created successfully:", booking.id);

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

  // Handle digital payment methods (card, Apple Pay, Google Pay, Wallet)
  const requiresPaymentIntent = ["card", "apple_pay", "google_pay", "wallet"].includes(paymentMethod);
  
  if (requiresPaymentIntent) {
    if (!paymentIntentId) {
      return jsonResponse(
        {
          id: booking.id,
          requiresPayment: true,
          status: booking.status,
          loyaltyPointsApplied,
          loyaltyCreditAppliedCents,
          loyaltyRemainingPoints,
          paymentMethod,
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
        } as any,
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

  // Broadcast live update to ADMIN for new booking
  const { publishLiveUpdate } = await import('@/lib/liveUpdates');
  void publishLiveUpdate(
    { type: 'bookings.created', bookingId: booking.id },
    {}
  );

  // Emit real-time system event for notification center
  const { emitBookingCreated } = await import('@/lib/realtime-events');
  const customerInfo = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { name: true, email: true },
  });
  void emitBookingCreated(
    booking.id,
    resolvedUserId,
    customerInfo?.name ?? customerInfo?.email ?? 'Customer',
    service.name,
    {
      servicePriceCents: snapshotServicePriceCents,
      finalAmountCents,
      paymentMethod,
      locationLabel,
      vehicleType,
      vehicleMake,
      vehicleModel,
    }
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
  } catch (error) {
    console.error("[bookings] POST error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function GET(req: Request) {
  // TEMPORARY: Bypass authentication for local testing
  const isLocalTest = req.headers.get('x-test-mode') === 'true';
  const mobileUser = isLocalTest ? null : await getMobileUserFromRequest(req);
  let userId: string | null = null;

  if (mobileUser) {
    userId = mobileUser.sub;
  } else if (!isLocalTest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse("Unauthorized", 401);
    }
    userId = (session.user as { id: string }).id;
  }

  // For local testing, use a hardcoded test user ID
  if (isLocalTest && !userId) {
    userId = 'test-user-id';
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
    userId: userId!,
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
      Service: true,
      Payment: true,
    },
  });

  // Enrich with distanceMeters, etaMinutes, and final price calculation
  const AVG_SPEED_KMH = 30; // configurable average speed for ETA
  const enriched = bookings.map((booking) => {
    let distanceMeters: number | undefined;
    let etaMinutes: number | undefined;

    // Calculate final price including all discounts, fees, and loyalty points
    let finalPriceCents = 0;
    const basePriceCents = booking.Service?.priceCents || 0;
    
    // Start with service price (use snapshot if available, otherwise current service price)
    const servicePriceCents = booking.servicePriceCents || basePriceCents;
    finalPriceCents = servicePriceCents;
    
    // Apply service discount if available
    if (booking.serviceDiscountPercentage && booking.serviceDiscountPercentage > 0) {
      const discountAmount = Math.round(finalPriceCents * (booking.serviceDiscountPercentage / 100));
      finalPriceCents -= discountAmount;
    }
    
    // Apply coupon discount if available
    if (booking.couponDiscountCents && booking.couponDiscountCents > 0) {
      finalPriceCents -= booking.couponDiscountCents;
    }
    
    // Apply tax if configured
    if (booking.taxPercentage && booking.taxPercentage > 0) {
      const taxAmount = Math.round(finalPriceCents * (booking.taxPercentage / 100));
      finalPriceCents += taxAmount;
    }
    
    // Apply Stripe fee if configured
    if (booking.stripeFeePercentage && booking.stripeFeePercentage > 0) {
      const stripeFeeAmount = Math.round(finalPriceCents * (booking.stripeFeePercentage / 100));
      finalPriceCents += stripeFeeAmount;
    }
    
    // Apply extra fees if configured
    if (booking.extraFeeCents && booking.extraFeeCents > 0) {
      finalPriceCents += booking.extraFeeCents;
    }
    
    // Apply loyalty credit if available
    if (booking.loyaltyCreditAppliedCents && booking.loyaltyCreditAppliedCents > 0) {
      finalPriceCents -= booking.loyaltyCreditAppliedCents;
    }
    
    // Ensure price doesn't go below 0
    finalPriceCents = Math.max(0, finalPriceCents);

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
      // Add calculated final price for display
      calculatedFinalPriceCents: finalPriceCents,
      calculatedFinalPrice: (finalPriceCents / 100).toFixed(2),
      // Also provide the base price for comparison
      basePriceCents: servicePriceCents,
      basePrice: (servicePriceCents / 100).toFixed(2),
      // Discount information
      totalDiscountCents: (servicePriceCents + (booking.taxPercentage ? Math.round(servicePriceCents * (booking.taxPercentage / 100)) : 0) + (booking.stripeFeePercentage ? Math.round((servicePriceCents - (booking.couponDiscountCents || 0) - (booking.loyaltyCreditAppliedCents || 0)) * (booking.stripeFeePercentage / 100)) : 0) + (booking.extraFeeCents || 0)) - finalPriceCents,
      hasDiscount: (booking.couponDiscountCents > 0) || (booking.loyaltyCreditAppliedCents > 0) || (booking.serviceDiscountPercentage !== null && booking.serviceDiscountPercentage > 0),
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
