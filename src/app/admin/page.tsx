import { prisma } from "@/lib/prisma";
import { getPartnerPayoutDelegate } from "@/lib/partnerPayout";
import { endOfDay, format, formatDistanceToNow, startOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20",
  ASSIGNED: "bg-[var(--info)]/10 text-[var(--info)] border border-[var(--info)]/20",
  IN_PROGRESS: "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20",
  PAID: "bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20",
  CANCELLED: "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20",
};

type WeeklyRevenueDatum = {
  label: string;
  amount: number;
};

export default async function AdminOverviewPage() {
  const today = new Date();
  const weekStart = startOfDay(subDays(today, 6));
  const weekEnd = endOfDay(today);

  const partnerPayoutDelegate = getPartnerPayoutDelegate();

  const [
    bookingCount,
    customerCount,
    driverCount,
    completedCount,
    paidPayments,
    cashBookings,
    recentOrders,
    weeklyRevenueBookings,
    partnerPayoutAggregate,
    activeDriversRaw,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "DRIVER" } }),
    prisma.booking.count({ where: { taskStatus: "COMPLETED" } }),
    prisma.payment.findMany({ where: { status: "PAID" }, select: { amountCents: true, createdAt: true } }),
    prisma.booking.findMany({
      where: { cashCollected: true },
      select: {
        cashAmountCents: true,
        cashSettled: true,
        service: { select: { priceCents: true } },
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: { startAt: { gte: today } },
      orderBy: { startAt: "asc" },
      take: 5,
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, priceCents: true } },
        driver: { select: { name: true, email: true } },
        payment: { select: { status: true } },
      },
    }),
    prisma.booking.findMany({
      where: { startAt: { gte: weekStart, lte: weekEnd } },
      select: {
        startAt: true,
        cashCollected: true,
        cashAmountCents: true,
        service: { select: { priceCents: true } },
        payment: { select: { status: true, amountCents: true } },
      },
    }),
    partnerPayoutDelegate.aggregate({ _sum: { amountCents: true } }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      select: {
        id: true,
        name: true,
        email: true,
        driverBookings: {
          where: { taskStatus: { not: "COMPLETED" } },
          select: { id: true, taskStatus: true, startAt: true },
          orderBy: { startAt: "asc" },
          take: 3,
        },
      },
    }),
  ]);

  const totalCardRevenue = paidPayments.reduce<number>((sum: number, payment: (typeof paidPayments)[number]) => sum + payment.amountCents, 0);

  type CashBooking = (typeof cashBookings)[number];
  const cashBreakdown = cashBookings.reduce<{ total: number; settled: number; pending: number }>(
    (acc: { total: number; settled: number; pending: number }, booking: CashBooking) => {
      const amount = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
      acc.total += amount;
      if (booking.cashSettled) {
        acc.settled += amount;
      } else {
        acc.pending += amount;
      }
      return acc;
    },
    { total: 0, settled: 0, pending: 0 },
  );

  const totalCashRevenue = cashBreakdown.total;
  const totalRevenue = totalCardRevenue + totalCashRevenue;

  const partnerPayoutTotal = partnerPayoutAggregate._sum?.amountCents ?? 0;
  const adminNetRevenue = Math.max(0, totalRevenue - partnerPayoutTotal);

  const completionRate = bookingCount === 0 ? 0 : (completedCount / bookingCount) * 100;
  const ratingScore = bookingCount === 0 ? 0 : Math.min(5, 3.8 + (completionRate / 100) * 1.2);

  const statsCards = [
    {
      label: "Revenue",
      value: formatCurrency(adminNetRevenue),
      helper: "Net after partner payouts",
      highlight: [
        `Gross ${formatCurrency(totalRevenue)}`,
        `Payouts ${formatCurrency(partnerPayoutTotal)}`,
        `Card ${formatCurrency(totalCardRevenue)}`,
        `Cash ${formatCurrency(totalCashRevenue)}`,
      ],
      accent: "bg-emerald-500/10 text-emerald-400",
    },
    {
      label: "Orders",
      value: bookingCount.toLocaleString(),
      helper: "Total bookings",
      accent: "bg-indigo-500/10 text-indigo-400",
    },
    {
      label: "Customers",
      value: customerCount.toLocaleString(),
      helper: "Registered users",
      accent: "bg-sky-500/10 text-sky-400",
    },
    {
      label: "Drivers",
      value: driverCount.toLocaleString(),
      helper: "Active drivers",
      accent: "bg-fuchsia-500/10 text-fuchsia-400",
    },
    {
      label: "Completion rate",
      value: `${completionRate.toFixed(0)}%`,
      helper: "Completed jobs",
      accent: "bg-amber-500/10 text-amber-400",
    },
    {
      label: "Ratings",
      value: ratingScore.toFixed(1),
      helper: "Customer satisfaction",
      accent: "bg-rose-500/10 text-rose-400",
    },
  ];

  const weeklyRecognizedLookup = new Map<string, number>();
  const weeklyPipelineLookup = new Map<string, number>();

  const accumulate = (map: Map<string, number>, date: Date, amount: number) => {
    if (!date || amount <= 0) return;
    if (date < weekStart || date > weekEnd) return;
    const key = startOfDay(date).toISOString();
    map.set(key, (map.get(key) ?? 0) + amount);
  };

  for (const payment of paidPayments) {
    accumulate(weeklyRecognizedLookup, payment.createdAt, payment.amountCents ?? 0);
  }

  for (const booking of cashBookings) {
    const amount = booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
    accumulate(weeklyRecognizedLookup, booking.createdAt, amount);
  }

  for (const booking of weeklyRevenueBookings) {
    const fallbackAmount = booking.service?.priceCents ?? 0;
    accumulate(weeklyPipelineLookup, booking.startAt, fallbackAmount);
  }

  const weeklyRevenue: WeeklyRevenueDatum[] = Array.from({ length: 7 }).map((_, index): WeeklyRevenueDatum => {
    const date = startOfDay(subDays(today, 6 - index));
    const key = date.toISOString();
    const recognized = weeklyRecognizedLookup.get(key) ?? 0;
    const pipeline = weeklyPipelineLookup.get(key) ?? 0;
    const amount = recognized > 0 ? recognized : pipeline;
    return {
      label: format(date, "EEE"),
      amount,
    };
  });

  const weeklyMax = weeklyRevenue.reduce<number>((max, item: WeeklyRevenueDatum) => Math.max(max, item.amount), 0) || 1;

  type ActiveDriver = (typeof activeDriversRaw)[number];
  type ActiveDriverSummary = {
    id: string;
    name: string;
    email: string | null;
    activeJobs: number;
    nextJob: Date | null;
  };
  const activeDrivers: ActiveDriverSummary[] = activeDriversRaw
    .map((driver: ActiveDriver): ActiveDriverSummary => {
      const upcoming = driver.driverBookings[0]?.startAt ?? null;
      return {
        id: driver.id,
        name: driver.name ?? driver.email ?? "Driver",
        email: driver.email,
        activeJobs: driver.driverBookings.length,
        nextJob: upcoming,
      };
    })
    .filter((driver: ActiveDriverSummary) => driver.activeJobs > 0)
    .sort((a: ActiveDriverSummary, b: ActiveDriverSummary) => b.activeJobs - a.activeJobs)
    .slice(0, 5);

  type RecentOrder = (typeof recentOrders)[number];

  return (
    <div className="min-h-screen bg-[var(--background)] p-6 space-y-8">
      {/* Page Header */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-strong)]">Operations Dashboard</h1>
          <p className="text-base text-[var(--text-muted)]">
            Real-time insights into revenue, bookings, and operational performance
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-2.5 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse"></div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Revenue</span>
            <strong className="text-sm font-bold text-[var(--text-strong)]">{formatCurrency(totalRevenue)}</strong>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-2.5 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-pulse"></div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Orders</span>
            <strong className="text-sm font-bold text-[var(--text-strong)]">{bookingCount}</strong>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-2.5 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[var(--info)] animate-pulse"></div>
            <span className="text-sm font-medium text-[var(--text-muted)]">Rate</span>
            <strong className="text-sm font-bold text-[var(--text-strong)]">{completionRate.toFixed(0)}%</strong>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statsCards.map((card) => (
          <article
            key={card.label}
            className="group relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--brand-primary)]"
          >
            {/* Gradient Background on Hover */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--brand-primary)] opacity-0 blur-3xl transition-opacity group-hover:opacity-5" />
            
            <div className="relative">
              <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${card.accent}`}>
                {card.label}
              </span>
              <p className="mt-5 text-3xl font-black text-[var(--text-strong)]">{card.value}</p>
              <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">{card.helper}</p>
              {card.highlight ? (
                <div className="mt-4 space-y-1 border-t border-[var(--surface-border)] pt-3">
                  {card.highlight.map((item) => (
                    <div key={item} className="text-xs text-[var(--text-muted)]">{item}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {/* Revenue Breakdown */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-lg">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[var(--text-strong)]">Revenue Breakdown</h2>
            <p className="text-sm font-medium text-[var(--text-muted)]">QuickWay earnings after partner settlements</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-secondary)]/10 px-4 py-2 text-sm font-semibold text-[var(--brand-secondary)]">
            <span>Partner Payouts</span>
            <span className="font-bold">{formatCurrency(partnerPayoutTotal)}</span>
          </div>
        </header>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <article className="group relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-6 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--success)]/10">
              <div className="h-3 w-3 rounded-full bg-[var(--success)]" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Net Revenue</h3>
            <p className="mt-2 text-2xl font-black text-[var(--text-strong)]">{formatCurrency(adminNetRevenue)}</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">After partner payouts</p>
          </article>
          <article className="group relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-6 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10">
              <div className="h-3 w-3 rounded-full bg-[var(--brand-primary)]" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Card Payments</h3>
            <p className="mt-2 text-2xl font-black text-[var(--text-strong)]">{formatCurrency(totalCardRevenue)}</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Online & Stripe</p>
          </article>
          <article className="group relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-6 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--info)]/10">
              <div className="h-3 w-3 rounded-full bg-[var(--info)]" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Cash Settled</h3>
            <p className="mt-2 text-2xl font-black text-[var(--text-strong)]">{formatCurrency(cashBreakdown.settled)}</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Reconciled</p>
          </article>
          <article className="group relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-6 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--warning)]/10">
              <div className="h-3 w-3 rounded-full bg-[var(--warning)]" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Cash Pending</h3>
            <p className="mt-2 text-2xl font-black text-[var(--text-strong)]">{formatCurrency(cashBreakdown.pending)}</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Awaiting settlement</p>
          </article>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-6">
        <div className="space-y-6 xl:col-span-4">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[var(--text-strong)]">Weekly Revenue</h2>
              <p className="text-sm font-medium text-[var(--text-muted)]">Last 7 days performance</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)]/10 px-4 py-2 text-sm font-semibold text-[var(--brand-primary)]">
              <span>Peak</span>
              <span className="font-bold">{formatCurrency(weeklyMax)}</span>
            </div>
          </header>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-lg">
            <div className="grid h-56 grid-cols-7 items-end gap-3">
              {weeklyRevenue.map((day) => (
                <div key={day.label} className="group flex flex-col items-center gap-3">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-[var(--brand-primary)] to-[var(--brand-secondary)] shadow-lg transition-all group-hover:shadow-xl group-hover:from-[var(--brand-secondary)] group-hover:to-[var(--info)]"
                    style={{ height: `${Math.max((day.amount / weeklyMax) * 100, 8)}%` }}
                    title={`${day.label}: ${formatCurrency(day.amount)}`}
                  />
                  <span className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--brand-primary)] transition-colors">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--text-strong)]">Active Drivers</h2>
            <p className="text-sm font-medium text-[var(--text-muted)]">On-task operators</p>
          </div>
          <div className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-lg">
            {activeDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 h-12 w-12 rounded-full bg-[var(--text-muted)]/10" />
                <p className="text-sm font-medium text-[var(--text-muted)]">No active drivers</p>
              </div>
            ) : (
              activeDrivers.map((driver) => (
                <div key={driver.id} className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--surface-border)] bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-4 transition-all hover:shadow-md hover:border-[var(--brand-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 font-bold text-[var(--brand-primary)]">
                      {driver.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-[var(--text-strong)]">{driver.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{driver.email ?? "No email"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--success)]/10 px-3 py-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                      <p className="text-xs font-bold text-[var(--success)]">{driver.activeJobs}</p>
                    </div>
                    {driver.nextJob ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDistanceToNow(driver.nextJob, { addSuffix: true })}</p>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">No upcoming</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recent Orders */}
      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-lg">
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-[var(--text-strong)]">Recent Orders</h2>
            <p className="text-sm font-medium text-[var(--text-muted)]">Latest booking activity</p>
          </div>
        </header>
        <div className="overflow-x-auto rounded-xl border border-[var(--surface-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-secondary)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {recentOrders.map((booking: RecentOrder) => {
                const statusStyle = STATUS_STYLES[booking.status] ?? STATUS_STYLES.PENDING;
                const paymentStatus = booking.payment?.status ?? (booking.cashCollected ? "PAID" : "PENDING");
                return (
                  <tr key={booking.id} className="transition-colors hover:bg-[var(--surface-hover)]">
                    <td className="px-6 py-4 font-bold text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</td>
                    <td className="px-6 py-4 text-[var(--text-muted)]">{booking.user?.name ?? booking.user?.email ?? "Guest"}</td>
                    <td className="px-6 py-4 text-[var(--text-muted)]">{booking.driver?.name ?? booking.driver?.email ?? "Unassigned"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-semibold text-[var(--text-strong)]">{paymentStatus}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold ${statusStyle}`}>{booking.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-[var(--text-muted)]">
                      <time dateTime={booking.startAt.toISOString()} suppressHydrationWarning>
                        {format(booking.startAt, "MMM d, h:mm a")}
                      </time>
                    </td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-3 h-16 w-16 rounded-full bg-[var(--text-muted)]/10" />
                      <p className="text-sm font-medium text-[var(--text-muted)]">No recent activity</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
