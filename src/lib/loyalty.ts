import prisma from "@/lib/prisma";
import {
  FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
  LOYALTY_POINTS_PER_AED_SETTING_KEY,
  LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY,
} from "@/app/admin/settings/pricingConstants";

export type LoyaltySettings = {
  pointsPerAed: number;
  pointsPerCreditAed: number;
  freeWashInterval: number | null;
};

export type LoyaltySummary = LoyaltySettings & {
  completedBookings: number;
  nextFreeWashIn: number | null;
  totalPointsEarned: number;
  pointsRedeemed: number;
  availablePoints: number;
  availableCreditCents: number;
  creditBalanceCents: number;
  eligibleForFreeWash: boolean;
  activeFreeWashReward?: {
    code: string;
    discountValueCents: number;
    expiresAt: Date | null;
  } | null;
};

const DEFAULT_POINTS_PER_AED = 1;
const DEFAULT_POINTS_PER_CREDIT_AED = 10;

export async function fetchLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const rows = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: [
            LOYALTY_POINTS_PER_AED_SETTING_KEY,
            LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY,
            FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
          ],
        },
      },
    });

    const pointsRaw = rows.find((row) => row.key === LOYALTY_POINTS_PER_AED_SETTING_KEY)?.value ?? null;
    const creditRaw = rows.find((row) => row.key === LOYALTY_POINTS_PER_CREDIT_AED_SETTING_KEY)?.value ?? null;
    const freeWashRaw = rows.find((row) => row.key === FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY)?.value ?? null;

    const parsedPoints = Number.parseInt(pointsRaw ?? "", 10);
    const parsedCredit = Number.parseInt(creditRaw ?? "", 10);
    const parsedFreeWash = Number.parseInt(freeWashRaw ?? "", 10);

    const finalSettings = {
      pointsPerAed:
        Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : DEFAULT_POINTS_PER_AED,
      pointsPerCreditAed:
        Number.isFinite(parsedCredit) && parsedCredit > 0 ? parsedCredit : DEFAULT_POINTS_PER_CREDIT_AED,
      freeWashInterval:
        Number.isFinite(parsedFreeWash) && parsedFreeWash > 0 ? parsedFreeWash : null,
    };

    console.log("[fetchLoyaltySettings] Settings loaded from DB:", finalSettings);
    return finalSettings;
  } catch (error) {
    console.error("[fetchLoyaltySettings] Failed to load from DB, using defaults:", error);
    return {
      pointsPerAed: DEFAULT_POINTS_PER_AED,
      pointsPerCreditAed: DEFAULT_POINTS_PER_CREDIT_AED,
      freeWashInterval: null,
    };
  }
}

export async function computeAvailablePoints(userId: string, redeemedPoints: number, pointsPerAed: number) {
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      payment: { select: { amountCents: true, status: true } },
      cashCollected: true,
      cashAmountCents: true,
    },
  });

  console.log(`[computeAvailablePoints] User ${userId}: Found ${bookings.length} bookings`);

  const totalPaid = bookings.reduce((sum, booking) => {
    const cardPaid = booking.payment?.status === "PAID" ? booking.payment.amountCents ?? 0 : 0;
    const cashPaid = booking.cashCollected ? booking.cashAmountCents ?? 0 : 0;
    const paidForBooking = cardPaid > 0 ? cardPaid : cashPaid;
    
    if (paidForBooking > 0) {
      console.log(`[computeAvailablePoints] Booking ${booking.id}: Paid ${paidForBooking} cents (${cardPaid > 0 ? 'card' : 'cash'})`);
    }
    
    return sum + (paidForBooking ?? 0);
  }, 0);

  const totalPointsEarned = pointsPerAed > 0 ? Math.floor((totalPaid / 100) * pointsPerAed) : 0;
  const availablePoints = Math.max(0, totalPointsEarned - redeemedPoints);
  
  console.log(`[computeAvailablePoints] Total paid: ${totalPaid} cents | Points earned: ${totalPointsEarned} | Redeemed: ${redeemedPoints} | Available: ${availablePoints}`);
  
  return availablePoints;
}

export async function computeLoyaltySummary(userId: string): Promise<LoyaltySummary> {
  const [settings, user, bookings] = await Promise.all([
    fetchLoyaltySettings(),
    prisma.user.findUnique({ where: { id: userId } }) as Promise<{
      id: string;
      loyaltyRedeemedPoints: number;
      loyaltyCreditCents: number;
    } | null>,
    prisma.booking.findMany({
      where: { userId },
      include: {
        service: true,
        payment: true,
      },
    }),
  ]);

  const pointsPerAed = settings.pointsPerAed;
  const pointsPerCreditAed = settings.pointsPerCreditAed;
  const freeWashInterval = settings.freeWashInterval;
  const pointsRedeemed = user?.loyaltyRedeemedPoints ?? 0;
  const creditBalanceCents = user?.loyaltyCreditCents ?? 0;

  let completedBookings = 0;
  let totalPaidCents = 0;

  bookings.forEach((booking) => {
    const cardPaid = booking.payment?.status === "PAID" ? booking.payment.amountCents ?? 0 : 0;
    const cashPaid = booking.cashCollected ? booking.cashAmountCents ?? 0 : 0;
    const paidForBooking = cardPaid > 0 ? cardPaid : cashPaid;

    if (paidForBooking > 0) {
      completedBookings += 1;
      totalPaidCents += paidForBooking;
    }
  });

  const totalPointsEarned = pointsPerAed > 0 ? Math.floor((totalPaidCents / 100) * pointsPerAed) : 0;
  const availablePoints = await computeAvailablePoints(userId, pointsRedeemed, pointsPerAed);
  const availableCreditCents = pointsPerCreditAed > 0 ? Math.floor((availablePoints * 100) / pointsPerCreditAed) : 0;

  let nextFreeWashIn: number | null = null;
  if (freeWashInterval && freeWashInterval > 0) {
    const remainder = completedBookings % freeWashInterval;
    nextFreeWashIn = remainder === 0 ? freeWashInterval : freeWashInterval - remainder;
  }

  const eligibleForFreeWash = nextFreeWashIn === 0 && !!freeWashInterval;

  let activeFreeWashReward: LoyaltySummary["activeFreeWashReward"] = null;

  const latestFreeWashBooking = await prisma.booking.findFirst({
    where: {
      userId,
      freeWashRewardCouponId: { not: null },
    },
    orderBy: { freeWashRewardIssuedAt: "desc" },
    select: {
      freeWashRewardCouponId: true,
      freeWashRewardCouponCode: true,
    },
  });

  if (latestFreeWashBooking?.freeWashRewardCouponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: latestFreeWashBooking.freeWashRewardCouponId },
      select: {
        id: true,
        discountValue: true,
        validUntil: true,
        active: true,
        redemptions: {
          select: { id: true },
        },
      },
    });

    const hasBeenRedeemed = (coupon?.redemptions?.length ?? 0) > 0;
    const isExpired = coupon?.validUntil ? coupon.validUntil < new Date() : false;
    if (coupon && coupon.active && !hasBeenRedeemed && !isExpired) {
      activeFreeWashReward = {
        code: latestFreeWashBooking.freeWashRewardCouponCode ?? coupon.id,
        discountValueCents: coupon.discountValue,
        expiresAt: coupon.validUntil ?? null,
      };
    }
  }

  return {
    pointsPerAed,
    pointsPerCreditAed,
    freeWashInterval,
    completedBookings,
    nextFreeWashIn,
    totalPointsEarned,
    pointsRedeemed,
    availablePoints,
    availableCreditCents,
    creditBalanceCents,
    eligibleForFreeWash,
    activeFreeWashReward,
  };
}
