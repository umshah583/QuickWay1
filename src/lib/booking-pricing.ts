import prisma from "@/lib/prisma";
import { calculateDiscountedPrice, applyFeesToPrice } from "@/lib/pricing";
import { fetchLoyaltySettings, computeAvailablePoints } from "@/lib/loyalty";
import { validateAndCalculateCoupon, CouponError } from "@/lib/coupons";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

export type BookingPricingRequest = {
  userId: string;
  serviceId: string;
  couponCode?: string | null;
  loyaltyPoints?: number | null;
  bookingId?: string | null;
};

export type BookingPricingResult = {
  serviceId: string;
  serviceName: string;
  basePriceCents: number;
  discountPercentage: number | null;
  discountedPriceCents: number;
  couponCode: string | null;
  couponId: string | null;
  couponDiscountCents: number;
  loyaltyPointsApplied: number;
  loyaltyCreditAppliedCents: number;
  finalAmountCents: number;
  availablePoints: number;
  remainingPoints: number;
  pointsPerAed: number;
  pointsPerCreditAed: number;
};

class PricingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PricingError";
    this.status = status;
  }
}

export async function calculateBookingPricing(request: BookingPricingRequest): Promise<BookingPricingResult> {
  const { userId, serviceId, couponCode, loyaltyPoints, bookingId } = request;

  const [service, user, loyaltySettings, pricingAdjustments] = await Promise.all([
    prisma.service.findFirst({
      where: { id: serviceId, active: true },
      select: {
        id: true,
        name: true,
        priceCents: true,
        discountPercentage: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyRedeemedPoints: true },
    }),
    fetchLoyaltySettings(),
    loadPricingAdjustmentConfig(),
  ]);

  if (!service) {
    throw new PricingError("Service not available", 404);
  }
  if (!user) {
    throw new PricingError("User not found", 404);
  }

  const basePriceCents = service.priceCents;
  if (basePriceCents <= 0) {
    throw new PricingError("Service price is not payable", 400);
  }

  const discountedPriceCents = calculateDiscountedPrice(basePriceCents, service.discountPercentage);

  let normalizedCoupon: string | null = null;
  let couponDiscountCents = 0;
  let couponId: string | null = null;

  if (couponCode && couponCode.trim()) {
    const result = await validateAndCalculateCoupon({
      code: couponCode,
      userId,
      serviceId: service.id,
      servicePriceCents: basePriceCents,
      serviceDiscountPercentage: service.discountPercentage,
      bookingId: bookingId ?? null,
    });
    normalizedCoupon = result.couponCode;
    couponDiscountCents = result.discountCents;
    couponId = result.couponId;
  }

  const priceAfterCoupon = Math.max(0, discountedPriceCents - couponDiscountCents);

  const pointsPerAed = loyaltySettings.pointsPerAed > 0 ? loyaltySettings.pointsPerAed : 0;
  const pointsPerCreditAed = loyaltySettings.pointsPerCreditAed > 0 ? loyaltySettings.pointsPerCreditAed : 0;

  const availablePoints = pointsPerAed > 0
    ? await computeAvailablePoints(userId, user.loyaltyRedeemedPoints ?? 0, pointsPerAed)
    : 0;

  let pointsToApply = loyaltyPoints ?? 0;
  if (pointsToApply < 0) {
    throw new PricingError("Invalid loyalty points amount", 400);
  }
  if (pointsToApply > availablePoints) {
    throw new PricingError("Not enough loyalty points", 400);
  }

  if (pointsPerAed === 0) {
    pointsToApply = 0;
  }

  let loyaltyCreditAppliedCents = 0;
  if (pointsPerCreditAed > 0 && pointsToApply > 0) {
    const maxPointsForPrice = Math.floor((priceAfterCoupon * pointsPerCreditAed) / 100);
    const effectivePoints = Math.min(pointsToApply, maxPointsForPrice);
    const creditFromPoints = Math.floor((effectivePoints * 100) / pointsPerCreditAed);
    loyaltyCreditAppliedCents = Math.min(priceAfterCoupon, creditFromPoints);
    pointsToApply = effectivePoints;
  } else {
    pointsToApply = 0;
  }

  const netAmountBeforeFees = Math.max(0, priceAfterCoupon - loyaltyCreditAppliedCents);
  const finalAmountCents = applyFeesToPrice(netAmountBeforeFees, pricingAdjustments);
  const remainingPoints = availablePoints - pointsToApply;

  return {
    serviceId: service.id,
    serviceName: service.name,
    basePriceCents,
    discountPercentage: service.discountPercentage ?? null,
    discountedPriceCents,
    couponCode: normalizedCoupon,
    couponId,
    couponDiscountCents,
    loyaltyPointsApplied: pointsToApply,
    loyaltyCreditAppliedCents,
    finalAmountCents,
    availablePoints,
    remainingPoints,
    pointsPerAed,
    pointsPerCreditAed,
  };
}

export { PricingError, CouponError };
