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

export function calculatePriceAfterCredit(
  priceCents: number,
  discountPercentage?: number | null,
  loyaltyCreditAppliedCents?: number | null,
): number {
  const discounted = calculateDiscountedPrice(priceCents, discountPercentage);
  const credit = loyaltyCreditAppliedCents && Number.isFinite(loyaltyCreditAppliedCents)
    ? Math.max(0, Math.round(loyaltyCreditAppliedCents))
    : 0;
  return Math.max(0, discounted - credit);
}

export function applyCouponAndCredits(
  priceCents: number,
  discountPercentage: number | null | undefined,
  couponDiscountCents: number | null | undefined,
  loyaltyCreditAppliedCents: number | null | undefined,
): number {
  const discounted = calculateDiscountedPrice(priceCents, discountPercentage);
  const coupon = couponDiscountCents && Number.isFinite(couponDiscountCents)
    ? Math.max(0, Math.round(couponDiscountCents))
    : 0;
  const loyalty = loyaltyCreditAppliedCents && Number.isFinite(loyaltyCreditAppliedCents)
    ? Math.max(0, Math.round(loyaltyCreditAppliedCents))
    : 0;

  return Math.max(0, discounted - coupon - loyalty);
}
