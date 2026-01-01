import prisma from "@/lib/prisma";
import { getMobileUserFromRequest } from "@/lib/mobile-session";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { fetchLoyaltySettings, computeAvailablePoints } from "@/lib/loyalty";
import { calculateDiscountedPrice, applyCouponAndCredits } from "@/lib/pricing";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// NOTE: Legacy publishLiveUpdate removed - loyalty updates don't need realtime notifications

export function OPTIONS() {
  return noContentResponse("POST,OPTIONS");
}

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

  const body = await req.json().catch(() => null);
  const bookingId = body?.bookingId as string | undefined;
  const pointsToUse = Number.parseInt(body?.points?.toString() ?? "", 10);

  if (!bookingId) {
    return errorResponse("Missing bookingId", 400);
  }
  if (!Number.isFinite(pointsToUse) || pointsToUse <= 0) {
    return errorResponse("Invalid points", 400);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      loyaltyCreditAppliedCents: true,
      loyaltyPointsApplied: true,
      couponDiscountCents: true,
      // Pricing snapshots - locked at booking creation time
      taxPercentage: true,
      stripeFeePercentage: true,
      extraFeeCents: true,
      service: { select: { priceCents: true, discountPercentage: true } },
    },
  });
  if (!booking || booking.userId !== userId) {
    return errorResponse("Booking not found", 404);
  }
  if (booking.status !== "PENDING") {
    return errorResponse("Cannot apply points to this booking", 400);
  }
  if ((booking.loyaltyPointsApplied ?? 0) > 0) {
    return errorResponse("Points already applied to this booking", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loyaltyRedeemedPoints: true },
  });
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const settings = await fetchLoyaltySettings();
  const availablePoints = await computeAvailablePoints(userId, user.loyaltyRedeemedPoints ?? 0, settings.pointsPerAed);

  if (pointsToUse > availablePoints) {
    return errorResponse("Not enough points", 400);
  }

  const { pointsPerCreditAed } = settings;
  const pointValueCents = pointsPerCreditAed > 0 ? Math.floor((pointsToUse * 100) / pointsPerCreditAed) : pointsToUse;
  if (pointValueCents <= 0) {
    return errorResponse("Points too low to redeem", 400);
  }

  const basePrice = booking.service.priceCents;
  const discount = booking.service.discountPercentage ?? 0;
  const discountedPrice = calculateDiscountedPrice(basePrice, discount);
  const priceAfterCoupon = Math.max(0, discountedPrice - (booking.couponDiscountCents ?? 0));
  const creditToApply = Math.min(pointValueCents, priceAfterCoupon);
  const remainingPrice = Math.max(0, priceAfterCoupon - creditToApply);

  // Compute the fully adjusted final amount (including tax/fees) for this booking
  // so that cash payments always use the same customer-facing amount as card.
  // CRITICAL: Use booking-level pricing snapshots (locked at booking creation)
  const currentSettings = await loadPricingAdjustmentConfig();
  const pricingAdjustments = {
    taxPercentage: booking.taxPercentage ?? currentSettings.taxPercentage ?? 0,
    stripeFeePercentage: booking.stripeFeePercentage ?? currentSettings.stripeFeePercentage ?? 0,
    extraFeeAmountCents: booking.extraFeeCents ?? currentSettings.extraFeeAmountCents ?? 0,
  };
  const finalAmountCents = applyCouponAndCredits(
    basePrice,
    discount,
    booking.couponDiscountCents ?? 0,
    creditToApply,
    pricingAdjustments,
  );

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        loyaltyCreditAppliedCents: creditToApply,
        loyaltyPointsApplied: pointsToUse,
        // Keep cashAmountCents in sync with the fully adjusted final amount so that
        // driver cash collection and admin collections never fall back to the raw
        // service price without discounts, coupons, or loyalty.
        cashAmountCents: finalAmountCents,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        loyaltyRedeemedPoints: {
          increment: pointsToUse,
        },
      },
    }),
  ]);

  // Loyalty update - no realtime notification needed, just return the updated values

  return jsonResponse({
    remainingAmountCents: remainingPrice,
    pointsUsed: pointsToUse,
    creditAppliedCents: creditToApply,
  });
}
