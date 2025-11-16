/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { calculateDiscountedPrice } from "@/lib/pricing";
import type { Prisma } from "@prisma/client";

export type CouponValidationResult = {
  couponId: string;
  couponCode: string;
  discountCents: number;
};

export class CouponError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CouponError";
    this.status = status;
  }
}

async function findCouponByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new CouponError("Enter a coupon code");
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalized },
  });

  if (!coupon) {
    throw new CouponError("Coupon not found", 404);
  }
  return coupon;
}

export async function validateAndCalculateCoupon(params: {
  code: string;
  userId: string;
  serviceId: string;
  servicePriceCents: number;
  serviceDiscountPercentage?: number | null;
  bookingId?: string | null;
}): Promise<CouponValidationResult> {
  const { code, userId, serviceId, servicePriceCents, serviceDiscountPercentage, bookingId } = params;

  const coupon = await findCouponByCode(code);

  if (!coupon.active) {
    throw new CouponError("This coupon is not active");
  }

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    throw new CouponError("This coupon is not yet active");
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    throw new CouponError("This coupon has expired");
  }

  if (!coupon.appliesToAllServices && !coupon.applicableServiceIds.includes(serviceId)) {
    throw new CouponError("This coupon cannot be used for the selected service");
  }

  const discountedServicePrice = calculateDiscountedPrice(servicePriceCents, serviceDiscountPercentage);
  if (discountedServicePrice <= 0) {
    throw new CouponError("This booking already qualifies for a free service");
  }

  if (coupon.minBookingAmountCents && discountedServicePrice < coupon.minBookingAmountCents) {
    throw new CouponError("Booking total does not meet the minimum amount for this coupon");
  }

  const redemptionWhereBase: Prisma.CouponRedemptionWhereInput = {
    couponId: coupon.id,
    bookingId: bookingId ? { not: bookingId } : undefined,
  };

  const redemptionWhereUser: Prisma.CouponRedemptionWhereInput = {
    couponId: coupon.id,
    userId,
    bookingId: bookingId ? { not: bookingId } : undefined,
  };

  const [totalRedemptions, userRedemptions] = await Promise.all([
    prisma.couponRedemption.count({ where: redemptionWhereBase }),
    prisma.couponRedemption.count({ where: redemptionWhereUser }),
  ]);

  if (coupon.maxRedemptions != null && totalRedemptions >= coupon.maxRedemptions) {
    throw new CouponError("This coupon has reached its usage limit");
  }

  if (coupon.maxRedemptionsPerUser != null && userRedemptions >= coupon.maxRedemptionsPerUser) {
    throw new CouponError("You have already used this coupon the maximum number of times");
  }

  let discountCents: number;
  if (coupon.discountType === "PERCENTAGE") {
    discountCents = Math.floor((discountedServicePrice * coupon.discountValue) / 100);
  } else {
    discountCents = coupon.discountValue;
  }

  if (discountCents <= 0) {
    throw new CouponError("This coupon does not provide any discount");
  }

  const boundedDiscount = Math.min(discountCents, discountedServicePrice);

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountCents: boundedDiscount,
  };
}

async function loadBookingForCoupon(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { priceCents: true, discountPercentage: true } },
    },
  });
}

function ensureBookingOwnership(booking: Awaited<ReturnType<typeof loadBookingForCoupon>>, userId: string) {
  if (!booking) {
    throw new CouponError("Booking not found", 404);
  }
  if (booking.userId !== userId) {
    throw new CouponError("Booking not found", 404);
  }
  if (booking.status !== "PENDING") {
    throw new CouponError("Cannot apply coupons to this booking");
  }
}

export async function applyCouponToBooking({ bookingId, userId, code }: { bookingId: string; userId: string; code: string }) {
  const booking = await loadBookingForCoupon(bookingId);
  ensureBookingOwnership(booking, userId);

  const service = booking!.service;
  const loyaltyCredits = booking!.loyaltyCreditAppliedCents ?? 0;

  const validation = await validateAndCalculateCoupon({
    code,
    userId,
    serviceId: booking!.serviceId,
    servicePriceCents: service.priceCents,
    serviceDiscountPercentage: service.discountPercentage,
    bookingId,
  });

  const redemptionClient = prisma.couponRedemption;

  await prisma.$transaction([
    redemptionClient.deleteMany({ where: { bookingId } }),
    redemptionClient.create({
      data: {
        couponId: validation.couponId,
        bookingId,
        userId,
        amountCents: validation.discountCents,
      },
    }),
    (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        coupon: { connect: { id: validation.couponId } },
        couponCode: validation.couponCode,
        couponDiscountCents: validation.discountCents,
      },
    }),
  ]);

  const discountedServicePrice = calculateDiscountedPrice(service.priceCents ?? 0, service.discountPercentage ?? 0);

  return {
    ...validation,
    remainingAmountCents: Math.max(0, discountedServicePrice - validation.discountCents - loyaltyCredits),
  };
}

export async function removeCouponFromBooking({ bookingId, userId }: { bookingId: string; userId: string }) {
  const booking = await loadBookingForCoupon(bookingId);
  ensureBookingOwnership(booking, userId);
  const service = booking!.service;
  const loyaltyCredits = booking!.loyaltyCreditAppliedCents ?? 0;

  const bookingClient = (prisma as any).booking;
  const redemptionClient = (prisma as any).couponRedemption;

  await prisma.$transaction([
    redemptionClient.deleteMany({ where: { bookingId } }),
    bookingClient.update({
      where: { id: bookingId },
      data: {
        coupon: { disconnect: true },
        couponCode: null,
        couponDiscountCents: 0,
      },
    }),
  ]);

  const discountedServicePrice = calculateDiscountedPrice(service.priceCents, service.discountPercentage);

  return {
    remainingAmountCents: Math.max(0, discountedServicePrice - loyaltyCredits),
  };
}
