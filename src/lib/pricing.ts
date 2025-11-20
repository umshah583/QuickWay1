export type PricingAdjustments = {
  taxPercentage?: number | null;
  stripeFeePercentage?: number | null;
  extraFeeAmountCents?: number | null;
};

export function calculateDiscountedPrice(
  priceCents: number,
  discountPercentage?: number | null,
): number {
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return 0;
  }
  if (!discountPercentage || !Number.isFinite(discountPercentage) || discountPercentage <= 0) {
    return Math.round(priceCents);
  }
  const bounded = Math.min(Math.max(discountPercentage, 0), 100);
  return Math.max(0, Math.round((priceCents * (100 - bounded)) / 100));
}

function applyFees(priceCents: number, adjustments?: PricingAdjustments | null): number {
  const base = Math.max(0, Math.round(priceCents));
  if (!adjustments) {
    return base;
  }

  const { taxPercentage, stripeFeePercentage, extraFeeAmountCents } = adjustments;
  let total = base;

  if (taxPercentage && Number.isFinite(taxPercentage) && taxPercentage > 0) {
    total += Math.round((base * Math.min(Math.max(taxPercentage, 0), 100)) / 100);
  }

  if (stripeFeePercentage && Number.isFinite(stripeFeePercentage) && stripeFeePercentage > 0) {
    total += Math.round((base * Math.min(Math.max(stripeFeePercentage, 0), 100)) / 100);
  }

  if (extraFeeAmountCents && Number.isFinite(extraFeeAmountCents) && extraFeeAmountCents > 0) {
    total += Math.round(extraFeeAmountCents);
  }

  return Math.max(0, total);
}

export function calculatePriceAfterCredit(
  priceCents: number,
  discountPercentage?: number | null,
  loyaltyCreditAppliedCents?: number | null,
  adjustments?: PricingAdjustments | null,
): number {
  const discounted = calculateDiscountedPrice(priceCents, discountPercentage);
  const credit = loyaltyCreditAppliedCents && Number.isFinite(loyaltyCreditAppliedCents)
    ? Math.max(0, Math.round(loyaltyCreditAppliedCents))
    : 0;
  const net = Math.max(0, discounted - credit);
  return applyFees(net, adjustments);
}

export function applyCouponAndCredits(
  priceCents: number,
  discountPercentage: number | null | undefined,
  couponDiscountCents: number | null | undefined,
  loyaltyCreditAppliedCents: number | null | undefined,
  adjustments?: PricingAdjustments | null,
): number {
  const discounted = calculateDiscountedPrice(priceCents, discountPercentage);
  const coupon = couponDiscountCents && Number.isFinite(couponDiscountCents)
    ? Math.max(0, Math.round(couponDiscountCents))
    : 0;
  const loyalty = loyaltyCreditAppliedCents && Number.isFinite(loyaltyCreditAppliedCents)
    ? Math.max(0, Math.round(loyaltyCreditAppliedCents))
    : 0;

  const net = Math.max(0, discounted - coupon - loyalty);
  return applyFees(net, adjustments);
}

export function applyFeesToPrice(priceCents: number, adjustments?: PricingAdjustments | null): number {
  return applyFees(priceCents, adjustments);
}
