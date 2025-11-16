import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getPartnerPayoutDelegate } from "@/lib/partnerPayout";

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

export async function loadTransactions(options: LoadTransactionsOptions = {}): Promise<TransactionSummary> {
  const { limit = DEFAULT_TRANSACTION_LIMIT, startDate, endDate } = options;

  const createdAtFilter = buildCreatedAtFilter(startDate, endDate);

  const paymentWhere = {
    status: "PAID" as const,
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const cashWhere = {
    cashCollected: true,
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const payoutWhere = createdAtFilter ? { createdAt: createdAtFilter } : undefined;

  const partnerPayoutDelegate = getPartnerPayoutDelegate();

  const [cardPayments, cashCollections, partnerPayouts] = await Promise.all([
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
            service: { select: { name: true } },
            partner: { select: { name: true } },
            user: { select: { name: true, email: true } },
            driver: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: cashWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        cashAmountCents: true,
        cashSettled: true,
        partner: { select: { name: true } },
        service: { select: { name: true, priceCents: true } },
        user: { select: { name: true, email: true } },
        driver: { select: { name: true, email: true } },
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

  type CardPayment = (typeof cardPayments)[number];
  type CashCollection = (typeof cashCollections)[number];
  type PartnerPayoutRow = {
    id: string;
    amountCents: number;
    createdAt: Date;
    note: string | null;
    partner: { name: string | null } | null;
    createdByAdmin: { name: string | null; email: string | null } | null;
  };

  const creditTransactions: TransactionRecord[] = [
    ...cardPayments.map((payment: CardPayment) => ({
      id: payment.id,
      type: "credit" as const,
      channel: payment.provider ?? "Card",
      amountCents: payment.amountCents,
      occurredAt: payment.createdAt,
      counterparty: payment.booking?.partner?.name ?? "QuickWay",
      description: `Card payment for ${payment.booking?.service?.name ?? "Service"}`,
      status: "Settled",
      bookingRef: payment.booking?.id,
      customerName: payment.booking?.user?.name ?? payment.booking?.user?.email ?? undefined,
      customerEmail: payment.booking?.user?.email ?? undefined,
      driverName: payment.booking?.driver?.name ?? payment.booking?.driver?.email ?? undefined,
      driverEmail: payment.booking?.driver?.email ?? undefined,
    })),
    ...cashCollections.map((booking: CashCollection) => ({
      id: booking.id,
      type: "credit" as const,
      channel: "Cash",
      amountCents: booking.cashAmountCents ?? booking.service?.priceCents ?? 0,
      occurredAt: booking.createdAt,
      counterparty: booking.partner?.name ?? "QuickWay",
      description: booking.cashSettled ? "Cash handover reconciled" : "Cash awaiting settlement",
      status: booking.cashSettled ? "Settled" : "Pending",
      bookingRef: booking.id,
      customerName: booking.user?.name ?? booking.user?.email ?? undefined,
      customerEmail: booking.user?.email ?? undefined,
      driverName: booking.driver?.name ?? booking.driver?.email ?? undefined,
      driverEmail: booking.driver?.email ?? undefined,
    } satisfies TransactionRecord)),
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
