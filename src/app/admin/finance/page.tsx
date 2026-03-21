import { prisma } from "@/lib/prisma";
import { FinanceDashboardClient } from "./FinanceDashboardClient";
import { startOfDay, subDays, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const today = new Date();
  
  // Fetch all payments
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Fetch partner payouts (commissions)
  const partnerPayouts = await prisma.partnerPayout.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Calculate metrics
  const totalRevenue = payments
    .filter(p => p.status === "PAID")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const onlineRevenue = payments
    .filter(p => p.status === "PAID" && p.provider === "STRIPE")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const cashRevenue = payments
    .filter(p => p.status === "PAID" && p.provider === "CASH")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const totalCommissions = partnerPayouts.reduce((sum, p) => sum + p.amountCents, 0);

  const settledPayments = payments.filter(p => p.status === "PAID").length;

  const refunds = payments
    .filter(p => p.status === "REFUNDED")
    .reduce((sum, p) => sum + p.amountCents, 0);

  // Revenue trend data (last 30 days)
  const revenueTrend = [];
  for (let i = 29; i >= 0; i--) {
    const date = subDays(today, i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayPayments = payments.filter(p => {
      const paymentDate = new Date(p.createdAt);
      return p.status === "PAID" && paymentDate >= dayStart && paymentDate <= dayEnd;
    });

    const dayRevenue = dayPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const dayOnline = dayPayments
      .filter(p => p.provider === "STRIPE")
      .reduce((sum, p) => sum + p.amountCents, 0);
    const dayCash = dayPayments
      .filter(p => p.provider === "CASH")
      .reduce((sum, p) => sum + p.amountCents, 0);

    revenueTrend.push({
      date: date.toISOString(),
      total: dayRevenue,
      online: dayOnline,
      cash: dayCash,
    });
  }

  // Payment method breakdown
  const paymentBreakdown = [
    {
      method: "Online (Stripe)",
      amount: onlineRevenue,
      count: payments.filter(p => p.status === "PAID" && p.provider === "STRIPE").length,
    },
    {
      method: "Cash",
      amount: cashRevenue,
      count: payments.filter(p => p.status === "PAID" && p.provider === "CASH").length,
    },
  ];

  return (
    <FinanceDashboardClient
      totalRevenue={totalRevenue}
      onlineRevenue={onlineRevenue}
      cashRevenue={cashRevenue}
      totalCommissions={totalCommissions}
      settledPayments={settledPayments}
      refunds={refunds}
      revenueTrend={revenueTrend}
      paymentBreakdown={paymentBreakdown}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions={payments as any}
    />
  );
}
