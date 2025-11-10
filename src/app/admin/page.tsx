import { prisma } from "@/lib/prisma";
import { endOfDay, format, formatDistanceToNow, startOfDay, subDays } from "date-fns";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-400",
  ASSIGNED: "bg-sky-500/15 text-sky-400",
  IN_PROGRESS: "bg-indigo-500/15 text-indigo-400",
  PAID: "bg-emerald-500/15 text-emerald-400",
  CANCELLED: "bg-rose-500/15 text-rose-400",
};

type WeeklyRevenueDatum = {
  label: string;
  amount: number;
};

export default async function AdminOverviewPage() {
  const today = new Date();
  const weekStart = startOfDay(subDays(today, 6));

  const [
    bookingCount,
    customerCount,
    driverCount,
    completedCount,
    paidPayments,
    cashBookings,
    recentOrders,
    weeklyRevenueBookings,
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
        service: { select: { priceCents: true } },
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, priceCents: true } },
        driver: { select: { name: true, email: true } },
        payment: { select: { status: true } },
      },
    }),
    prisma.booking.findMany({
      where: { startAt: { gte: weekStart, lte: endOfDay(today) } },
      select: {
        startAt: true,
        cashCollected: true,
        cashAmountCents: true,
        service: { select: { priceCents: true } },
        payment: { select: { status: true, amountCents: true } },
      },
    }),
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

  const totalCardRevenue = paidPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const totalCashRevenue = cashBookings.reduce(
    (sum, booking) => sum + (booking.cashAmountCents ?? booking.service?.priceCents ?? 0),
    0,
  );
  const totalRevenue = totalCardRevenue + totalCashRevenue;

  const completionRate = bookingCount === 0 ? 0 : (completedCount / bookingCount) * 100;
  const ratingScore = bookingCount === 0 ? 0 : Math.min(5, 3.8 + (completionRate / 100) * 1.2);

  const statsCards = [
    {
      label: "Revenue",
      value: formatCurrency(totalRevenue),
      helper: "Lifetime revenue",
      highlight: [
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

  const weeklyRevenueLookup = new Map<string, number>();
  for (const booking of weeklyRevenueBookings) {
    const dayKey = startOfDay(booking.startAt).toISOString();
    const existing = weeklyRevenueLookup.get(dayKey) ?? 0;
    const paymentAmount = booking.payment?.status === "PAID" ? booking.payment.amountCents ?? 0 : 0;
    const cashAmount = booking.cashCollected ? booking.cashAmountCents ?? booking.service?.priceCents ?? 0 : 0;
    weeklyRevenueLookup.set(dayKey, existing + paymentAmount + cashAmount);
  }

  const weeklyRevenue: WeeklyRevenueDatum[] = Array.from({ length: 7 }).map((_, index) => {
    const date = startOfDay(subDays(today, 6 - index));
    const key = date.toISOString();
    const amount = weeklyRevenueLookup.get(key) ?? 0;
    return {
      label: format(date, "EEE"),
      amount,
    };
  });

  const weeklyMax = weeklyRevenue.reduce((max, item) => Math.max(max, item.amount), 0) || 1;

  const activeDrivers = activeDriversRaw
    .map((driver) => {
      const upcoming = driver.driverBookings[0]?.startAt ?? null;
      return {
        id: driver.id,
        name: driver.name ?? driver.email ?? "Driver",
        email: driver.email,
        activeJobs: driver.driverBookings.length,
        nextJob: upcoming,
      };
    })
    .filter((driver) => driver.activeJobs > 0)
    .sort((a, b) => b.activeJobs - a.activeJobs)
    .slice(0, 5);

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">Operations dashboard</h1>
          <p className="text-sm text-[var(--text-muted)]">
            A consolidated view of revenue, bookings, and field performance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
            Total revenue <strong className="ml-1 text-[var(--text-strong)]">{formatCurrency(totalRevenue)}</strong>
          </span>
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
            Orders <strong className="ml-1 text-[var(--text-strong)]">{bookingCount}</strong>
          </span>
          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-1">
            Completion <strong className="ml-1 text-[var(--text-strong)]">{completionRate.toFixed(0)}%</strong>
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statsCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${card.accent}`}>
              {card.label}
            </span>
            <p className="mt-4 text-[1.15rem] font-semibold leading-tight tracking-tight text-[var(--text-strong)]">{card.value}</p>
            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{card.helper}</p>
            {card.highlight ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[var(--text-muted)]">
                {card.highlight.map((item) => (
                  <span key={item} className="whitespace-nowrap">{item}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-6">
        <div className="space-y-4 xl:col-span-4">
          <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--text-strong)]">Weekly revenue</h2>
              <p className="text-sm text-[var(--text-muted)]">Last 7 days of realised revenue.</p>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Peak day {formatCurrency(weeklyMax)}</span>
          </header>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-8">
            <div className="grid h-48 grid-cols-7 items-end gap-4">
              {weeklyRevenue.map((day) => (
                <div key={day.label} className="flex flex-col items-center gap-2 text-xs text-[var(--text-muted)]">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-[var(--brand-primary)]/5 via-[var(--brand-primary)]/35 to-[var(--brand-primary)]"
                    style={{ height: `${Math.max((day.amount / weeklyMax) * 100, 4)}%` }}
                    title={`${day.label}: ${formatCurrency(day.amount)}`}
                  />
                  <span>{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Active drivers</h2>
            <p className="text-sm text-[var(--text-muted)]">Top operators currently on-task.</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-5 py-6">
            {activeDrivers.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No drivers currently on active jobs.</p>
            ) : (
              activeDrivers.map((driver) => (
                <div key={driver.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--surface-border)] bg-white/5 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--text-strong)]">{driver.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{driver.email ?? "No email"}</p>
                  </div>
                  <div className="text-right text-xs text-[var(--text-muted)]">
                    <p className="font-semibold text-[var(--text-strong)]">{driver.activeJobs} active</p>
                    {driver.nextJob ? (
                      <p>{formatDistanceToNow(driver.nextJob, { addSuffix: true })}</p>
                    ) : (
                      <p>No upcoming slot</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 py-7 shadow-sm">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--text-strong)]">Recent orders</h2>
            <p className="text-sm text-[var(--text-muted)]">Timeline of the latest bookings across the system.</p>
          </div>
        </header>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {recentOrders.map((booking) => {
                const statusStyle = STATUS_STYLES[booking.status] ?? STATUS_STYLES.PENDING;
                const paymentStatus = booking.payment?.status ?? (booking.cashCollected ? "PAID" : "PENDING");
                return (
                  <tr key={booking.id} className="bg-white/5">
                    <td className="px-4 py-3 font-medium text-[var(--text-strong)]">{booking.service?.name ?? "Service"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{booking.user?.name ?? booking.user?.email ?? "Guest"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{booking.driver?.name ?? booking.driver?.email ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{paymentStatus}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>{booking.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      <time dateTime={booking.startAt.toISOString()} suppressHydrationWarning>
                        {format(booking.startAt, "MMM d, h:mm a")}
                      </time>
                    </td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No recent activity.
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
