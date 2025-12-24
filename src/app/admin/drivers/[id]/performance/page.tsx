import { prisma } from "@/lib/prisma";
import { format, subDays, startOfDay } from "date-fns";
import { Clock, CheckCircle, Calendar, ArrowLeft, DollarSign, Car } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function calculateHoursWorked(startedAt: Date, endedAt: Date | null): number {
  const end = endedAt || new Date();
  const diffMs = end.getTime() - new Date(startedAt).getTime();
  return diffMs / (1000 * 60 * 60);
}

export default async function DriverPerformancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: driverId } = await params;

  // Get driver details
  const driver = await prisma.user.findUnique({
    where: { id: driverId, role: "DRIVER" },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      partner: {
        select: { id: true, name: true },
      },
    },
  });

  if (!driver) {
    notFound();
  }

  const today = new Date();
  const last30Days = startOfDay(subDays(today, 30));
  const last7Days = startOfDay(subDays(today, 7));

  // Get driver days (shifts)
  const driverDays = await prisma.driverDay.findMany({
    where: {
      driverId,
      date: { gte: last30Days },
    },
    orderBy: { startedAt: "desc" },
  });

  // Get completed bookings
  const completedBookings = await prisma.booking.findMany({
    where: {
      driverId,
      taskStatus: "COMPLETED",
      updatedAt: { gte: last30Days },
    },
    include: {
      service: { select: { name: true, priceCents: true } },
      payment: { select: { status: true, amountCents: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculate statistics
  const totalShifts = driverDays.length;
  const completedShifts = driverDays.filter((d) => d.status === "CLOSED").length;
  
  const totalHoursWorked = driverDays.reduce((sum, d) => {
    return sum + calculateHoursWorked(d.startedAt, d.endedAt);
  }, 0);
  
  const averageHoursPerShift = completedShifts > 0 ? totalHoursWorked / completedShifts : 0;

  const totalTasksCompleted = driverDays.reduce((sum, d) => sum + d.tasksCompleted, 0);

  // Weekly performance
  const weeklyShifts = driverDays.filter((d) => new Date(d.date) >= last7Days);
  const weeklyHours = weeklyShifts.reduce((sum, d) => sum + calculateHoursWorked(d.startedAt, d.endedAt), 0);
  const weeklyTasks = weeklyShifts.reduce((sum, d) => sum + d.tasksCompleted, 0);

  // Calculate revenue generated
  const revenueGenerated = completedBookings.reduce((sum, b) => {
    if (b.payment?.status === "PAID") return sum + (b.payment.amountCents ?? 0);
    if (b.cashCollected) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
    return sum;
  }, 0);

  // Tasks per hour efficiency
  const tasksPerHour = totalHoursWorked > 0 ? totalTasksCompleted / totalHoursWorked : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/business-day"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-medium)]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Driver Performance</h1>
          <p className="text-sm text-[var(--text-muted)]">Detailed performance metrics for {driver.name || "Driver"}</p>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl font-bold text-white">
            {driver.name?.charAt(0).toUpperCase() || "D"}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--text-strong)]">{driver.name || "Unknown Driver"}</h2>
            <p className="text-sm text-[var(--text-muted)]">{driver.email}</p>
            {driver.phoneNumber && <p className="text-sm text-[var(--text-muted)]">{driver.phoneNumber}</p>}
          </div>
          {driver.partner && (
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Partner</p>
              <p className="text-sm font-medium text-[var(--text-strong)]">{driver.partner.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Hours"
          value={formatDuration(totalHoursWorked)}
          subtitle="Last 30 days"
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Tasks Completed"
          value={totalTasksCompleted.toString()}
          subtitle={`${tasksPerHour.toFixed(1)} per hour`}
          icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Revenue Generated"
          value={formatCurrency(revenueGenerated)}
          subtitle="Last 30 days"
          icon={<DollarSign className="h-5 w-5 text-purple-600" />}
          bgColor="bg-purple-50"
        />
        <StatCard
          title="Shifts Completed"
          value={`${completedShifts}/${totalShifts}`}
          subtitle={`Avg ${formatDuration(averageHoursPerShift)}/shift`}
          icon={<Calendar className="h-5 w-5 text-orange-600" />}
          bgColor="bg-orange-50"
        />
      </div>

      {/* Weekly Summary */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-4">This Week&apos;s Performance</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-secondary)] p-4">
            <p className="text-2xl font-bold text-[var(--text-strong)]">{formatDuration(weeklyHours)}</p>
            <p className="text-sm text-[var(--text-muted)]">Hours worked</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-secondary)] p-4">
            <p className="text-2xl font-bold text-[var(--text-strong)]">{weeklyTasks}</p>
            <p className="text-sm text-[var(--text-muted)]">Tasks completed</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-secondary)] p-4">
            <p className="text-2xl font-bold text-[var(--text-strong)]">{weeklyShifts.length}</p>
            <p className="text-sm text-[var(--text-muted)]">Shifts this week</p>
          </div>
        </div>
      </div>

      {/* Shift History */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Shift History</h3>
          <p className="text-sm text-[var(--text-muted)]">Last 30 days of shifts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">End</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Hours</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Tasks</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Cash Collected</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {driverDays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Clock className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                    <p className="mt-4 text-sm text-[var(--text-muted)]">No shift history available</p>
                  </td>
                </tr>
              ) : (
                driverDays.map((day) => {
                  const hours = calculateHoursWorked(day.startedAt, day.endedAt);
                  return (
                    <tr key={day.id} className="hover:bg-[var(--surface-secondary)]/50">
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                        {format(new Date(day.date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-medium)]">
                        {format(new Date(day.startedAt), "HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-medium)]">
                        {day.endedAt ? format(new Date(day.endedAt), "HH:mm") : (
                          <span className="text-emerald-600">Ongoing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-strong)]">
                        {formatDuration(hours)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                        {day.tasksCompleted}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                        {formatCurrency(day.cashCollectedCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          day.status === "OPEN"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {day.status === "OPEN" ? "On Duty" : "Completed"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Completed Bookings */}
      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Recent Completed Bookings</h3>
          <p className="text-sm text-[var(--text-muted)]">Last 10 completed tasks</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Service</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {completedBookings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Car className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
                    <p className="mt-4 text-sm text-[var(--text-muted)]">No completed bookings yet</p>
                  </td>
                </tr>
              ) : (
                completedBookings.slice(0, 10).map((booking) => {
                  const amount = booking.payment?.amountCents ?? booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
                  const paymentType = booking.cashCollected ? "Cash" : "Card";
                  return (
                    <tr key={booking.id} className="hover:bg-[var(--surface-secondary)]/50">
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text-strong)]">
                        {booking.service?.name || "Unknown Service"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-medium)]">
                        {format(new Date(booking.updatedAt), "MMM d, HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[var(--text-strong)]">
                        {formatCurrency(amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          paymentType === "Cash"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {paymentType}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  bgColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--text-strong)]">{value}</p>
          <p className="text-sm text-[var(--text-medium)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
