import type { Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma';
import { getPartnerPayoutDelegate } from '@/lib/partnerPayout';
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from "../settings/pricingConstants";
import type { PricingAdjustmentConfig } from "@/lib/pricingSettings";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

export const partnerFinancialInclude = {
  drivers: {
    include: {
      driverBookings: {
        select: {
          id: true,
          startAt: true,
          taskStatus: true,
          status: true,
          cashCollected: true,
          cashAmountCents: true,
          cashSettled: true,
          service: { select: { name: true, priceCents: true } },
          payment: { select: { status: true, amountCents: true } },
        },
        orderBy: { startAt: "desc" },
      },
    },
  },
  bookings: {
    select: {
      id: true,
      startAt: true,
      taskStatus: true,
      status: true,
      cashCollected: true,
      cashAmountCents: true,
      cashSettled: true,
      createdAt: true,
      service: { select: { name: true, priceCents: true } },
      payment: { select: { status: true, amountCents: true } },
    },
    orderBy: { startAt: "desc" },
  },
} as const;

export const partnerFinancialSelect = {
  id: true,
  name: true,
  email: true,
  commissionPercentage: true,
  createdAt: true,
  updatedAt: true,
  drivers: partnerFinancialInclude.drivers,
  bookings: partnerFinancialInclude.bookings,
} as const;

export type PartnerFinancialRecord = Prisma.PartnerGetPayload<{ select: typeof partnerFinancialSelect }>;
export type CombinedBooking =
  | PartnerFinancialRecord["bookings"][number]
  | PartnerFinancialRecord["drivers"][number]["driverBookings"][number];

export type PartnerPayoutRecord = {
  id: string;
  partnerId: string;
  amountCents: number;
  note: string | null;
  periodMonth: number;
  periodYear: number;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string | null;
  createdByAdmin: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

export function collectPartnerBookings(partner: PartnerFinancialRecord): CombinedBooking[] {
  const map = new Map<string, CombinedBooking>();

  partner.bookings.forEach((booking) => {
    map.set(booking.id, booking as CombinedBooking);
  });

  partner.drivers.forEach((driver) => {
    driver.driverBookings.forEach((booking) => {
      if (!map.has(booking.id)) {
        map.set(booking.id, booking as CombinedBooking);
      }
    });
  });

  return Array.from(map.values());
}

export function getBookingGrossValue(booking: CombinedBooking): number {
  if (booking.payment?.status === "PAID") {
    return booking.payment.amountCents ?? booking.service?.priceCents ?? 0;
  }
  if (booking.cashCollected) {
    return booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
  }
  return 0;
}

export function computeNetEarnings(bookings: CombinedBooking[], commissionPercentage: number): number {
  const normalized = Number.isFinite(commissionPercentage) ? commissionPercentage : 100;
  const multiplier = Math.max(0, Math.min(normalized, 100)) / 100;

  return bookings.reduce((sum: number, booking: CombinedBooking) => {
    const gross = getBookingGrossValue(booking);
    if (gross <= 0) {
      return sum;
    }
    return sum + Math.round(gross * multiplier);
  }, 0);
}

export function countActiveJobs(bookings: CombinedBooking[]): number {
  return bookings.filter((booking) => booking.taskStatus !== "COMPLETED").length;
}

export function countCompletedJobs(bookings: CombinedBooking[]): number {
  return bookings.filter((booking) => booking.taskStatus === "COMPLETED").length;
}

export type PartnerFinancialTotals = {
  totalNet: number;
  cashPendingGross: number;
  cashSettledGross: number;
  invoicesPaidGross: number;
  invoicesPendingGross: number;
};

function isBookingSettled(booking: CombinedBooking): boolean {
  if (booking.payment) {
    return booking.payment.status === "PAID";
  }

  if (booking.cashCollected) {
    return Boolean(booking.cashSettled);
  }

  return false;
}

function computeBookingNetBase(
  booking: CombinedBooking,
  grossCents: number,
  adjustments: PricingAdjustmentConfig | null,
): number {
  if (grossCents <= 0) {
    return 0;
  }

  const taxPercentage = adjustments?.taxPercentage ?? 0;
  const stripeFeePercentage = adjustments?.stripeFeePercentage ?? 0;
  const stripeFixedFeeCents = adjustments?.extraFeeAmountCents ?? 0;

  // Reverse the fee calculation: gross = base * (1 + tax% + stripe%) + fixed
  // So: base = (gross - fixed) / (1 + tax% + stripe%)
  const taxDecimal = taxPercentage > 0 ? taxPercentage / 100 : 0;
  const stripeDecimal = stripeFeePercentage > 0 ? stripeFeePercentage / 100 : 0;
  const fixedCents = stripeFixedFeeCents > 0 ? stripeFixedFeeCents : 0;

  if (booking.cashCollected) {
    // For cash: gross = base * (1 + tax%)
    const multiplier = 1 + taxDecimal;
    const baseCents = multiplier > 0 ? Math.round(grossCents / multiplier) : 0;
    return baseCents;
  }

  if (booking.payment?.status === "PAID") {
    const grossBeforeFixed = Math.max(0, grossCents - fixedCents);
    const multiplier = 1 + taxDecimal + stripeDecimal;
    const baseCents = multiplier > 0 ? Math.round(grossBeforeFixed / multiplier) : 0;
    return baseCents;
  }

  return 0;
}

export function summariseFinancials(
  bookings: CombinedBooking[],
  commissionPercentage: number,
  adjustments: PricingAdjustmentConfig | null,
): PartnerFinancialTotals {
  const multiplier = Math.max(0, Math.min(Number.isFinite(commissionPercentage) ? commissionPercentage : 100, 100)) / 100;
  return bookings.reduce<PartnerFinancialTotals>(
    (acc, booking) => {
      const gross = getBookingGrossValue(booking);
      if (gross > 0) {
        const settled = isBookingSettled(booking);
        if (settled) {
          const netBase = computeBookingNetBase(booking, gross, adjustments);
          if (netBase > 0) {
            const netForPartner = Math.round(netBase * multiplier);
            console.log('[partner-payout]', {
              id: booking.id,
              isCash: booking.cashCollected,
              isCard: Boolean(booking.payment && booking.payment.status === "PAID"),
              gross,
              netBase,
              commissionPercentage,
              netForPartner,
              taxPercentage: adjustments?.taxPercentage ?? null,
              stripeFeePercentage: adjustments?.stripeFeePercentage ?? null,
              stripeFixedFeeCents: adjustments?.extraFeeAmountCents ?? null,
            });
            acc.totalNet += netForPartner;
          }
        }
      }

      if (gross > 0 && booking.cashCollected) {
        if (booking.cashSettled) {
          acc.cashSettledGross += gross;
        } else {
          acc.cashPendingGross += gross;
        }
      }

      if (gross > 0 && booking.payment) {
        if (booking.payment.status === "PAID") {
          acc.invoicesPaidGross += gross;
        } else {
          acc.invoicesPendingGross += gross;
        }
      }

      return acc;
    },
    {
      totalNet: 0,
      cashPendingGross: 0,
      cashSettledGross: 0,
      invoicesPaidGross: 0,
      invoicesPendingGross: 0,
    },
  );
}

export type MonthlyPayoutSummary = {
  month: number;
  year: number;
  totalCents: number;
  count: number;
};

export type PartnerFinancialSnapshot = {
  partner: PartnerFinancialRecord;
  combinedBookings: CombinedBooking[];
  commissionPercentage: number;
  totals: PartnerFinancialTotals;
  payouts: PartnerPayoutRecord[];
  totalPayoutsCents: number;
  outstandingCents: number;
  monthlyPayouts: MonthlyPayoutSummary[];
};

export async function loadPartnerFinancialSnapshot(partnerId: string): Promise<PartnerFinancialSnapshot | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: partnerFinancialSelect,
  });

  if (!partner) {
    return null;
  }

  const defaultCommissionSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true },
  });
  const commissionPercentage =
    partner.commissionPercentage ?? parsePercentageSetting(defaultCommissionSetting?.value) ?? 100;

  const combinedBookings = collectPartnerBookings(partner);
  const pricingAdjustments = await loadPricingAdjustmentConfig();
  const totals = summariseFinancials(combinedBookings, commissionPercentage, pricingAdjustments);

  const partnerPayoutDelegate = getPartnerPayoutDelegate();

  const payouts = (await partnerPayoutDelegate.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    include: { createdByAdmin: true },
  })) as PartnerPayoutRecord[];

  const totalPayoutsCents = payouts.reduce<number>(
    (sum: number, payout: PartnerPayoutRecord) => sum + payout.amountCents,
    0,
  );
  const outstandingCents = Math.max(0, totals.totalNet - totalPayoutsCents);

  const monthlyMap = new Map<string, MonthlyPayoutSummary>();
  payouts.forEach((payout: PartnerPayoutRecord) => {
    const key = `${payout.periodYear}-${payout.periodMonth}`;
    const existing = monthlyMap.get(key);
    if (existing) {
      existing.totalCents += payout.amountCents;
      existing.count += 1;
    } else {
      monthlyMap.set(key, {
        month: payout.periodMonth,
        year: payout.periodYear,
        totalCents: payout.amountCents,
        count: 1,
      });
    }
  });

  const monthlyPayouts = Array.from(monthlyMap.values()).sort((a, b) => {
    if (a.year === b.year) {
      return b.month - a.month;
    }
    return b.year - a.year;
  });

  return {
    partner,
    combinedBookings,
    commissionPercentage,
    totals,
    payouts,
    totalPayoutsCents,
    outstandingCents,
    monthlyPayouts,
  };
}
