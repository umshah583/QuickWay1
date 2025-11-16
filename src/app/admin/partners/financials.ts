import type { Prisma } from "@prisma/client";
import { prisma } from '@/lib/prisma';
import { getPartnerPayoutDelegate } from '@/lib/partnerPayout';
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from "../settings/pricingConstants";

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

export function summariseFinancials(bookings: CombinedBooking[], commissionPercentage: number): PartnerFinancialTotals {
  const multiplier = Math.max(0, Math.min(Number.isFinite(commissionPercentage) ? commissionPercentage : 100, 100)) / 100;
  return bookings.reduce<PartnerFinancialTotals>(
    (acc, booking) => {
      const gross = getBookingGrossValue(booking);
      if (gross > 0) {
        const settled = isBookingSettled(booking);
        if (settled) {
          const net = Math.round(gross * multiplier);
          acc.totalNet += net;
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
  const totals = summariseFinancials(combinedBookings, commissionPercentage);

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
