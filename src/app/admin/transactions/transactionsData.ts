import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getPartnerPayoutDelegate } from "@/lib/partnerPayout";
import { loadPricingAdjustmentConfig } from "@/lib/pricingSettings";

export const DEFAULT_TRANSACTION_LIMIT = 200;

export type TransactionRecord = {
  id: string;
  type: "credit" | "debit";
  channel: string;
  amountCents: number;
  occurredAt: Date;
  counterparty: string;
  description: string;
  status?: string;
  bookingRef?: string;
  customerName?: string;
  customerEmail?: string;
  driverName?: string;
  driverEmail?: string;
  recordedByName?: string;
  recordedByEmail?: string;
  // Optional breakdown fields for credits (card/cash/subscription)
  grossAmountCents?: number;
  vatCents?: number;
  stripePercentFeeCents?: number;
  stripeFixedFeeCents?: number;
  netAmountCents?: number;
};

export type TransactionSummary = {
  transactions: TransactionRecord[];
  totalCredits: number;
  totalDebits: number;
  net: number;
};

export type LoadTransactionsOptions = {
  limit?: number;
  startDate?: Date;
  endDate?: Date;
};

function buildCreatedAtFilter(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) {
    return undefined;
  }
  const filter: { gte?: Date; lt?: Date } = {};
  if (startDate) {
    filter.gte = startDate;
  }
  if (endDate) {
    filter.lt = addDays(endDate, 1);
  }
  return filter;
}

function formatShortAmount(cents: number): string {
  return `AED ${(cents / 100).toFixed(2)}`;
}

export async function loadTransactions(options: LoadTransactionsOptions = {}): Promise<TransactionSummary> {
  const { limit = DEFAULT_TRANSACTION_LIMIT, startDate, endDate } = options;

  const createdAtFilter = buildCreatedAtFilter(startDate, endDate);

   const pricingAdjustments = await loadPricingAdjustmentConfig();
   const taxPercentage = pricingAdjustments.taxPercentage ?? 0;
   const stripeFeePercentage = pricingAdjustments.stripeFeePercentage ?? 0;
   const stripeFixedFeeCents = pricingAdjustments.extraFeeAmountCents ?? 0;

   const computeOnlineNet = (grossCents: number) => {
     // Reverse the fee calculation: gross = base * (1 + tax% + stripe%) + fixed
     // So: base = (gross - fixed) / (1 + tax% + stripe%)
     const taxDecimal = taxPercentage > 0 ? taxPercentage / 100 : 0;
     const stripeDecimal = stripeFeePercentage > 0 ? stripeFeePercentage / 100 : 0;
     const fixedCents = stripeFixedFeeCents > 0 ? stripeFixedFeeCents : 0;
     
     const grossBeforeFixed = Math.max(0, grossCents - fixedCents);
     const multiplier = 1 + taxDecimal + stripeDecimal;
     const baseCents = multiplier > 0 ? Math.round(grossBeforeFixed / multiplier) : 0;
     
     // Calculate actual fees based on the base
     const vatCents = Math.round(baseCents * taxDecimal);
     const stripePercentCents = Math.round(baseCents * stripeDecimal);
     const netCents = baseCents;
     
     return {
       grossCents,
       vatCents,
       stripePercentCents,
       stripeFixedFeeCents: fixedCents,
       netCents,
     };
   };

   const computeCashNet = (grossCents: number) => {
     // Reverse the VAT calculation: gross = base * (1 + tax%)
     // So: base = gross / (1 + tax%)
     const taxDecimal = taxPercentage > 0 ? taxPercentage / 100 : 0;
     const multiplier = 1 + taxDecimal;
     const baseCents = multiplier > 0 ? Math.round(grossCents / multiplier) : 0;
     
     // Calculate actual VAT based on the base
     const vatCents = Math.round(baseCents * taxDecimal);
     const netCents = baseCents;
     
     return {
       grossCents,
       vatCents,
       netCents,
     };
   };

  const paymentWhere = {
    status: "PAID" as const,
    // Now we include all PAID payments (STRIPE and CASH) since submit-cash creates Payment records.
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const subscriptionWhere = createdAtFilter ? { createdAt: createdAtFilter } : undefined;
  const payoutWhere = createdAtFilter ? { createdAt: createdAtFilter } : undefined;

  const partnerPayoutDelegate = getPartnerPayoutDelegate();

  type PrismaWithSubscriptions = typeof prisma & {
    packageSubscription: {
      findMany: (args: unknown) => Promise<{
        id: string;
        createdAt: Date;
        pricePaidCents: number;
        package: { name: string | null } | null;
        user: { name: string | null; email: string | null } | null;
      }[]>;
    };
  };

  const prismaWithSubs = prisma as PrismaWithSubscriptions;

  const [payments, subscriptions, partnerPayouts] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        provider: true,
        booking: {
          select: {
            id: true,
            cashSettled: true,
            service: { select: { name: true } },
            partner: { select: { name: true } },
            user: { select: { name: true, email: true } },
            driver: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prismaWithSubs.packageSubscription.findMany({
      where: subscriptionWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        pricePaidCents: true,
        package: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    partnerPayoutDelegate.findMany({
      where: payoutWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        note: true,
        partner: { select: { name: true } },
        createdByAdmin: { select: { name: true, email: true } },
      },
    }),
  ]);

  type PaymentRow = (typeof payments)[number];
  type SubscriptionPayment = (typeof subscriptions)[number];
  type PartnerPayoutRow = {
    id: string;
    amountCents: number;
    createdAt: Date;
    note: string | null;
    partner: { name: string | null } | null;
    createdByAdmin: { name: string | null; email: string | null } | null;
  };

  const creditTransactions: TransactionRecord[] = [
    ...payments.map((payment: PaymentRow) => {
      const isStripe = payment.provider === "STRIPE";
      const breakdown = isStripe 
        ? computeOnlineNet(payment.amountCents) 
        : computeCashNet(payment.amountCents);
        
      const serviceName = payment.booking?.service?.name ?? "Service";
      const channel = isStripe ? "Online" : "Cash";
      
      let description = isStripe 
        ? `Card payment for ${serviceName}` 
        : `Cash payment for ${serviceName}`;
      
      let status = "Settled";
      if (!isStripe) {
        status = payment.booking?.cashSettled ? "Settled" : "Pending";
        if (!payment.booking?.cashSettled) {
           description = "Cash awaiting settlement";
        }
      }

      return {
        id: payment.id,
        type: "credit" as const,
        channel,
        amountCents: breakdown.netCents,
        occurredAt: payment.createdAt,
        counterparty: payment.booking?.partner?.name ?? "QuickWay",
        description,
        status,
        bookingRef: payment.booking?.id,
        customerName: payment.booking?.user?.name ?? payment.booking?.user?.email ?? undefined,
        customerEmail: payment.booking?.user?.email ?? undefined,
        driverName: payment.booking?.driver?.name ?? payment.booking?.driver?.email ?? undefined,
        driverEmail: payment.booking?.driver?.email ?? undefined,
        grossAmountCents: breakdown.grossCents,
        vatCents: breakdown.vatCents,
        stripePercentFeeCents: isStripe ? (breakdown as any).stripePercentCents : 0,
        stripeFixedFeeCents: isStripe ? (breakdown as any).stripeFixedFeeCents : 0,
        netAmountCents: breakdown.netCents,
      };
    }),
    ...subscriptions.map((sub: SubscriptionPayment) => {
      const breakdown = computeOnlineNet(sub.pricePaidCents);
      return {
        id: sub.id,
        type: "credit" as const,
        channel: "Online",
        amountCents: breakdown.netCents,
        occurredAt: sub.createdAt,
        counterparty: "QuickWay",
        description: `Subscription payment for ${sub.package?.name ?? "Package"}`,
        status: "Settled",
        customerName: sub.user?.name ?? sub.user?.email ?? undefined,
        customerEmail: sub.user?.email ?? undefined,
        grossAmountCents: breakdown.grossCents,
        vatCents: breakdown.vatCents,
        stripePercentFeeCents: breakdown.stripePercentCents,
        stripeFixedFeeCents: breakdown.stripeFixedFeeCents,
        netAmountCents: breakdown.netCents,
      } satisfies TransactionRecord;
    }),
  ];

  const debitTransactions: TransactionRecord[] = (partnerPayouts as PartnerPayoutRow[]).map((payout) => ({
    id: payout.id,
    type: "debit" as const,
    channel: "Partner payout",
    amountCents: payout.amountCents,
    occurredAt: payout.createdAt,
    counterparty: payout.partner?.name ?? "Partner",
    description: payout.note ?? "Partner earnings settlement",
    status: "Completed",
    recordedByName: payout.createdByAdmin?.name ?? payout.createdByAdmin?.email ?? undefined,
    recordedByEmail: payout.createdByAdmin?.email ?? undefined,
  }));

  const transactions = [...creditTransactions, ...debitTransactions].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
  );

  const totalCredits = creditTransactions.reduce<number>((sum, tx) => sum + tx.amountCents, 0);
  const totalDebits = debitTransactions.reduce<number>((sum, tx) => sum + tx.amountCents, 0);

  return {
    transactions,
    totalCredits,
    totalDebits,
    net: totalCredits - totalDebits,
  };
}
