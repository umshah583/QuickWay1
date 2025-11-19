import { requirePartnerSession } from "@/lib/partner-auth";
import prisma from "@/lib/prisma";
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote, Wallet } from "lucide-react";
import { DEFAULT_PARTNER_COMMISSION_SETTING_KEY, parsePercentageSetting } from "@/app/admin/settings/pricingConstants";

export const dynamic = "force-dynamic";

export default async function PartnerEarningsPage() {
  const session = await requirePartnerSession();
  const partnerUserId = session.user?.id;

  const partner = await prisma.partner.findUnique({
    where: { userId: partnerUserId },
    select: { id: true, name: true, commissionPercentage: true },
  });

  if (!partner) {
    return (
      <div className="px-4 py-10">
        <p className="text-sm text-rose-600">Partner profile not found.</p>
      </div>
    );
  }

  // Get all drivers under this partner
  const [drivers, defaultCommissionSetting] = await Promise.all([
    prisma.user.findMany({
      where: {
        partnerId: partner.id,
        role: "DRIVER",
      },
      select: { id: true, name: true },
    }),
    prisma.adminSetting.findUnique({
      where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
      select: { value: true },
    }),
  ]);

  const driverIds = drivers.map((d) => d.id);

  const commissionPercentValue =
    partner.commissionPercentage ?? parsePercentageSetting(defaultCommissionSetting?.value) ?? 100;
  const commissionRate = Math.max(0, Math.min(commissionPercentValue, 100)) / 100;

  // Calculate earnings statistics
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Today's earnings
  const todayEarnings = await prisma.payment.aggregate({
    where: {
      booking: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: "PAID",
        updatedAt: {
          gte: today,
        },
      },
    },
    _sum: {
      amountCents: true,
    },
    _count: {
      id: true,
    },
  });

  // This month's earnings
  const thisMonthEarnings = await prisma.payment.aggregate({
    where: {
      booking: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: "PAID",
        updatedAt: {
          gte: thisMonth,
        },
      },
    },
    _sum: {
      amountCents: true,
    },
    _count: {
      id: true,
    },
  });

  // Last month's earnings
  const lastMonthEarnings = await prisma.payment.aggregate({
    where: {
      booking: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: "PAID",
        updatedAt: {
          gte: lastMonth,
          lt: thisMonth,
        },
      },
    },
    _sum: {
      amountCents: true,
    },
  });

  // Total earnings all time
  const totalEarnings = await prisma.payment.aggregate({
    where: {
      booking: {
        OR: [
          { partnerId: partner.id },
          ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
        ],
        status: "PAID",
      },
    },
    _sum: {
      amountCents: true,
    },
    _count: {
      id: true,
    },
  });

  // Recent earnings (last 10 completed bookings)
  const recentEarnings = await prisma.booking.findMany({
    where: {
      OR: [
        { partnerId: partner.id },
        ...(driverIds.length > 0 ? [{ driverId: { in: driverIds } }] : []),
      ],
      status: "PAID",
    },
    include: {
      service: {
        select: {
          name: true,
          priceCents: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
      driver: {
        select: {
          name: true,
        },
      },
      payment: {
        select: {
          amountCents: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 10,
  });

  // Calculate partner commission based on normalized percentage
  const partnerCommission = (totalEarnings._sum?.amountCents || 0) * commissionRate;

  // Calculate month-over-month growth
  const lastMonthTotal = lastMonthEarnings._sum?.amountCents || 0;
  const thisMonthTotal = thisMonthEarnings._sum?.amountCents || 0;
  const growthPercent = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
    : thisMonthTotal > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-strong)]">Earnings</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Track your revenue and commission earnings
          </p>
        </div>
      </div>

      {/* Earnings Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
              <DollarSign className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">
                AED {(todayEarnings._sum?.amountCents || 0) / 100}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Today&apos;s Earnings</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">
                AED {(thisMonthEarnings._sum?.amountCents || 0) / 100}
              </p>
              <p className="text-xs text-[var(--text-muted)]">This Month</p>
              <p className={`text-xs ${growthPercent >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}% vs last month
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">
                AED {(partnerCommission / 100).toFixed(2)}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Commission ({(commissionRate * 100).toFixed(0)}%)</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-strong)]">
                {totalEarnings._count?.id || 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Total Bookings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Earnings */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Recent Earnings</h3>
          <p className="text-sm text-[var(--text-muted)]">Your latest completed bookings</p>
        </div>

        {recentEarnings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
            <h3 className="mt-4 text-lg font-medium text-[var(--text-strong)]">No earnings yet</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Completed bookings will appear here with their earnings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {recentEarnings.map((earning) => {
                  // For earnings, we need to get the payment amount. For now, show service price as approximation
                  const paymentAmount = earning.payment?.amountCents || (earning.service.priceCents * (1 - (earning.couponDiscountCents / 100)));
                  const commission = (paymentAmount / 100) * commissionRate;
                  return (
                    <tr key={earning.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--text-strong)]">{earning.service.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[var(--text-medium)]">{earning.user.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[var(--text-medium)]">
                          {earning.driver?.name || "Unassigned"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[var(--text-medium)]">
                          {new Date(earning.updatedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[var(--text-strong)]">
                          AED {(paymentAmount / 100).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-green-600">
                          AED {commission.toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
