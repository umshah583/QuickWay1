import prisma from "@/lib/prisma";
import { getAdminSettingsClient } from "@/app/admin/settings/adminSettingsClient";
import {
  FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY,
  LOYALTY_POINTS_PER_AED_SETTING_KEY,
} from "@/app/admin/settings/pricingConstants";

export type LoyaltySettings = {
  pointsPerAed: number;
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
};

const DEFAULT_POINTS_PER_AED = 1;

export async function fetchLoyaltySettings(): Promise<LoyaltySettings> {
  const client = getAdminSettingsClient();
  if (!client) {
    return { pointsPerAed: DEFAULT_POINTS_PER_AED, freeWashInterval: null };
  }

  const rows = await client.findMany();
  const pointsRaw = rows.find((row) => row.key === LOYALTY_POINTS_PER_AED_SETTING_KEY)?.value ?? null;
  const freeWashRaw = rows.find((row) => row.key === FREE_WASH_EVERY_N_BOOKINGS_SETTING_KEY)?.value ?? null;

  const parsedPoints = Number.parseInt(pointsRaw ?? "", 10);
  const parsedFreeWash = Number.parseInt(freeWashRaw ?? "", 10);

  return {
    pointsPerAed:
      Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : DEFAULT_POINTS_PER_AED,
    freeWashInterval:
      Number.isFinite(parsedFreeWash) && parsedFreeWash > 0 ? parsedFreeWash : null,
  };
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
  const freeWashInterval = settings.freeWashInterval;
  const pointsRedeemed = user?.loyaltyRedeemedPoints ?? 0;
  const creditBalanceCents = user?.loyaltyCreditCents ?? 0;

  let completedBookings = 0;
  let totalPaidCents = 0;

  bookings.forEach((booking) => {
    const isPaid = booking.status === "PAID";
    const hasCash = booking.cashCollected && (booking.cashAmountCents ?? 0) > 0;
    if (isPaid || hasCash) {
      completedBookings += 1;
    }

    const paymentAmount = booking.payment?.status === "PAID" ? booking.payment.amountCents ?? 0 : 0;
    const cashAmount = booking.cashCollected ? booking.cashAmountCents ?? 0 : 0;
    totalPaidCents += paymentAmount + cashAmount;
  });

  const totalPointsEarned = pointsPerAed > 0 ? Math.floor((totalPaidCents / 100) * pointsPerAed) : 0;
  const rawAvailable = totalPointsEarned - pointsRedeemed;
  const availablePoints = rawAvailable > 0 ? rawAvailable : 0;
  const availableCreditCents = pointsPerAed > 0 ? Math.floor((availablePoints * 100) / pointsPerAed) : 0;

  let nextFreeWashIn: number | null = null;
  if (freeWashInterval && freeWashInterval > 0) {
    const remainder = completedBookings % freeWashInterval;
    nextFreeWashIn = remainder === 0 ? freeWashInterval : freeWashInterval - remainder;
  }

  return {
    pointsPerAed,
    freeWashInterval,
    completedBookings,
    nextFreeWashIn,
    totalPointsEarned,
    pointsRedeemed,
    availablePoints,
    availableCreditCents,
    creditBalanceCents,
  };
}
