/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { sendFreeWashCouponEmail } from "@/lib/email";

const FREE_WASH_MAX_DISCOUNT_CENTS = 5000; // AED 50
const FREE_WASH_COUPON_EXPIRY_DAYS = 30;
const FREE_WASH_COUPON_PREFIX = "FREEWASH";

const bookingClient = (prisma as any).booking;
const couponClient = (prisma as any).coupon;

async function generateUniqueCouponCode(): Promise<string> {
  // Try a few times to avoid race condition on unique constraint
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const code = `${FREE_WASH_COUPON_PREFIX}-${suffix}`;
    const existing = await couponClient.findUnique({ where: { code } });
    if (!existing) {
      return code;
    }
  }
  // Fallback to timestamp-based code
  return `${FREE_WASH_COUPON_PREFIX}-${Date.now()}`;
}

type RewardParams = {
  bookingId: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  maxDiscountCents?: number;
};

export async function issueFreeWashRewardCoupon({
  bookingId,
  userId,
  userEmail,
  userName,
  maxDiscountCents = FREE_WASH_MAX_DISCOUNT_CENTS,
}: RewardParams): Promise<void> {
  const booking = await bookingClient.findUnique({
    where: { id: bookingId },
    select: { id: true, freeWashRewardCouponId: true },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found when issuing free wash reward`);
  }

  if (booking.freeWashRewardCouponId) {
    // Already issued
    return;
  }

  let resolvedEmail = userEmail ?? null;
  let resolvedName = userName ?? null;

  if (!resolvedEmail || !resolvedName) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    resolvedEmail = resolvedEmail ?? user?.email ?? null;
    resolvedName = resolvedName ?? user?.name ?? null;
  }

  const code = await generateUniqueCouponCode();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + FREE_WASH_COUPON_EXPIRY_DAYS);

  const coupon = await couponClient.create({
    data: {
      code,
      name: "Free Wash Reward",
      description: `Reward issued for user ${userId} after completing the free-wash milestone.`,
      discountType: "AMOUNT",
      discountValue: maxDiscountCents,
      maxRedemptions: 1,
      maxRedemptionsPerUser: 1,
      minBookingAmountCents: 0,
      validFrom: issuedAt,
      validUntil: expiresAt,
      active: true,
      appliesToAllServices: true,
      applicableServiceIds: [],
    },
  });

  await bookingClient.update({
    where: { id: bookingId },
    data: {
      freeWashRewardCouponId: coupon.id,
      freeWashRewardCouponCode: coupon.code,
      freeWashRewardIssuedAt: issuedAt,
    },
  });

  if (resolvedEmail) {
    try {
      await sendFreeWashCouponEmail({
        to: resolvedEmail,
        name: resolvedName ?? null,
        couponCode: coupon.code,
        expiresAt,
        maxValueCents: maxDiscountCents,
      });
    } catch (emailError) {
      console.error("[free-wash] Failed to send coupon email", emailError);
    }
  }
}
