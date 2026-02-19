import prisma from "@/lib/prisma";
import { calculateDiscountedPrice } from "@/lib/pricing";
import { fetchLoyaltySettings, computeAvailablePoints } from "@/lib/loyalty";
import { validateAndCalculateCoupon, CouponError } from "@/lib/coupons";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";
import { resolveAreaPricing } from "@/lib/area-resolver";

export type BookingPricingRequest = {
  userId: string;
  serviceId: string;
  couponCode?: string | null;
  loyaltyPoints?: number | null;
  bookingId?: string | null;
  vehicleCount?: number | null;
  servicePriceCentsOverride?: number | null;
  // GPS coordinates for area-based pricing
  latitude?: number | null;
  longitude?: number | null;
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
  taxPercentage: number | null;
  vatCents: number;
  vehicleCount: number;
  // Snapshot fields for preserving pricing at booking time
  servicePriceCents: number;
  serviceDiscountPercentage: number | null;
  stripeFeePercentage: number | null;
  extraFeeCents: number;
  // Area-based pricing fields
  areaId: string | null;
  areaName: string | null;
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
  const { userId, serviceId, couponCode, loyaltyPoints, bookingId, vehicleCount: rawVehicleCount, servicePriceCentsOverride, latitude, longitude } = request;

  const vehicleCount = rawVehicleCount && Number.isFinite(rawVehicleCount) && rawVehicleCount > 0
    ? Math.floor(rawVehicleCount)
    : 1;

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

  // Resolve area-based pricing if coordinates provided
  let areaId: string | null = null;
  let areaName: string | null = null;
  let areaPriceCents: number | null = null;
  let areaDiscountPercentage: number | null = null;

  if (latitude && longitude && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    console.log("[booking-pricing] Resolving area pricing for coordinates:", { latitude, longitude });
    const areaPricing = await resolveAreaPricing(
      serviceId,
      latitude,
      longitude,
      service.priceCents,
      service.discountPercentage
    );
    
    if (areaPricing) {
      areaId = areaPricing.areaId;
      areaName = areaPricing.areaName;
      areaPriceCents = areaPricing.priceCents;
      areaDiscountPercentage = areaPricing.discountPercentage;
      console.log("[booking-pricing] Area pricing resolved:", { areaId, areaName, areaPriceCents, areaDiscountPercentage });
    }
  }

  const isUsingOverride = servicePriceCentsOverride && Number.isFinite(servicePriceCentsOverride) && servicePriceCentsOverride > 0;
  
  // Priority: 1) Override, 2) Area price, 3) Service base price
  const basePriceCentsSingle = isUsingOverride
    ? Math.round(servicePriceCentsOverride)
    : areaPriceCents ?? service.priceCents;
  
  // Use area discount if available, otherwise service discount
  const effectiveDiscountPercentage = areaDiscountPercentage ?? service.discountPercentage;
  
  const basePriceCents = basePriceCentsSingle * vehicleCount;
  if (basePriceCents <= 0) {
    throw new PricingError("Service price is not payable", 400);
  }

  // If using override, it's already the final display price (base - discount + VAT + Stripe fee), so use it directly
  const discountedPriceCents = isUsingOverride
    ? basePriceCents
    : calculateDiscountedPrice(basePriceCents, effectiveDiscountPercentage);

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

  console.log("[booking-pricing] Loyalty settings:", { pointsPerAed, pointsPerCreditAed });
  console.log("[booking-pricing] User loyalty state:", { loyaltyRedeemedPoints: user.loyaltyRedeemedPoints });

  const availablePoints = pointsPerAed > 0
    ? await computeAvailablePoints(userId, user.loyaltyRedeemedPoints ?? 0, pointsPerAed)
    : 0;

  console.log("[booking-pricing] Available points:", availablePoints);

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

  // If using override, the price already includes VAT + Stripe fee per service, so skip both
  // Otherwise, calculate VAT and Stripe fee on the net amount
  const rawTaxPercentage = pricingAdjustments?.taxPercentage;
  const normalizedTaxPercentage =
    rawTaxPercentage && Number.isFinite(rawTaxPercentage) && rawTaxPercentage > 0
      ? Math.min(Math.max(rawTaxPercentage, 0), 100)
      : 0;

  const vatCents = !isUsingOverride && normalizedTaxPercentage > 0
    ? Math.round((netAmountBeforeFees * normalizedTaxPercentage) / 100)
    : 0;

  const subtotalWithVat = netAmountBeforeFees + vatCents;

  const rawStripePercentage = pricingAdjustments?.stripeFeePercentage;
  const normalizedStripePercentage =
    rawStripePercentage && Number.isFinite(rawStripePercentage) && rawStripePercentage > 0
      ? Math.min(Math.max(rawStripePercentage, 0), 100)
      : 0;

  const stripeFeeCents = !isUsingOverride && normalizedStripePercentage > 0
    ? Math.round((subtotalWithVat * normalizedStripePercentage) / 100)
    : 0;

  // Always apply the fixed extra fee on the total (whether using override or not)
  const extraFeeCents = pricingAdjustments?.extraFeeAmountCents
    && Number.isFinite(pricingAdjustments.extraFeeAmountCents)
    ? Math.max(0, Math.round(pricingAdjustments.extraFeeAmountCents))
    : 0;

  const finalAmountCents = Math.max(0, subtotalWithVat + stripeFeeCents + extraFeeCents);
  const remainingPoints = availablePoints - pointsToApply;

  return {
    serviceId: service.id,
    serviceName: service.name,
    basePriceCents,
    discountPercentage: effectiveDiscountPercentage ?? null,
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
    taxPercentage: normalizedTaxPercentage > 0 ? normalizedTaxPercentage : null,
    vatCents,
    vehicleCount,
    // Snapshot fields - lock pricing at booking creation time
    servicePriceCents: basePriceCentsSingle,
    serviceDiscountPercentage: effectiveDiscountPercentage ?? null,
    stripeFeePercentage: normalizedStripePercentage > 0 ? normalizedStripePercentage : null,
    extraFeeCents,
    // Area-based pricing fields
    areaId,
    areaName,
  };
}

export { PricingError, CouponError };
