import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";

/**
 * GET /api/bookings/history
 * Returns all bookings for the authenticated customer, ordered by most recent first
 * Includes completed, pending, and in-progress bookings
 */
export async function GET(req: Request) {
  const mobileUser = await getMobileUserFromRequest(req);
  
  if (!mobileUser) {
    return errorResponse("Unauthorized", 401);
  }

  const userId = mobileUser.sub;

  try {
    // Fetch all bookings for this customer, ordered by most recent first
    const bookings = await prisma.booking.findMany({
      where: {
        userId,
      },
      orderBy: { startAt: "desc" },
      include: {
        Service: true,
        Payment: true,
        User_Booking_driverIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Enrich with distanceMeters and etaMinutes for IN_PROGRESS bookings
    const AVG_SPEED_KMH = 30;
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
      }

      return {
        id: booking.id,
        serviceName: booking.Service.name,
        serviceId: booking.serviceId,
        status: booking.status,
        taskStatus: booking.taskStatus,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt?.toISOString() || null,
        createdAt: booking.createdAt.toISOString(),
        completedAt: booking.taskCompletedAt?.toISOString() || null,
        locationLabel: booking.locationLabel,
        locationCoordinates: booking.locationCoordinates,
        vehicleMake: booking.vehicleMake,
        vehicleModel: booking.vehicleModel,
        vehicleColor: booking.vehicleColor,
        vehicleType: booking.vehicleType,
        vehiclePlate: booking.vehiclePlate,
        totalPriceCents: calculateTotalPrice(booking),
        driverId: booking.driverId,
        driverName: booking.User_Booking_driverIdToUser?.name || null,
        distanceMeters,
        etaMinutes,
      };
    });

    console.log(`[bookings/history] Returning ${enriched.length} bookings for user ${userId}`);
    
    return jsonResponse(enriched);
  } catch (error) {
    console.error("[bookings/history] Error fetching booking history:", error);
    return errorResponse("Failed to fetch booking history", 500);
  }
}

/**
 * Calculate total price for a booking including all fees and discounts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateTotalPrice(booking: any): number {
  // If payment exists, use the payment amount
  if (booking.Payment?.amountCents) {
    return booking.Payment.amountCents;
  }

  // If cash amount is set, use that
  if (booking.cashAmountCents) {
    return booking.cashAmountCents;
  }

  // Calculate from service price with snapshots
  let total = booking.servicePriceCents || booking.Service?.priceCents || 0;

  // Apply service discount if available
  if (booking.serviceDiscountPercentage) {
    total = total * (1 - booking.serviceDiscountPercentage / 100);
  }

  // Apply coupon discount
  if (booking.couponDiscountCents) {
    total = Math.max(0, total - booking.couponDiscountCents);
  }

  // Apply loyalty credit
  if (booking.loyaltyCreditAppliedCents) {
    total = Math.max(0, total - booking.loyaltyCreditAppliedCents);
  }

  // Add tax
  if (booking.taxPercentage) {
    total = total * (1 + booking.taxPercentage / 100);
  }

  // Add Stripe fee for card payments
  if (booking.payment?.provider === "STRIPE" && booking.stripeFeePercentage) {
    total = total * (1 + booking.stripeFeePercentage / 100);
  }

  // Add extra fee
  if (booking.extraFeeCents) {
    total = total + booking.extraFeeCents;
  }

  // Multiply by vehicle count
  if (booking.vehicleCount && booking.vehicleCount > 1) {
    total = total * booking.vehicleCount;
  }

  return Math.round(total);
}

export function OPTIONS() {
  return noContentResponse();
}
