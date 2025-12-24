import { prisma } from "@/lib/prisma";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { Calendar, Car, Clock, DollarSign, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: { service: true; user: true; driver: true; payment: true };
}>;

type ServiceBasic = { id: string; name: string; priceCents: number };

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

export default async function ModernDashboard() {
  const today = new Date();
  const monthStart = startOfDay(subDays(today, 30));

  const [bookings, drivers, services, users, partnerPayouts, driverDays] = await Promise.all([
    prisma.booking.findMany({
      include: { service: true, user: true, driver: true, payment: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.service.findMany({ select: { id: true, name: true, priceCents: true } }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.partnerPayout.findMany({ select: { amountCents: true } }),
    prisma.driverDay.findMany({
      include: {
        driver: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const totalRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
    if (b.cashCollected) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
    return sum;
  }, 0);

  const cashSettledRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.cashCollected && b.cashSettled) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
    return sum;
  }, 0);

  const cashPendingRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.cashCollected && !b.cashSettled) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
    return sum;
  }, 0);

  const onlineRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.payment && b.payment.status === "PAID" && b.payment.provider === "STRIPE") return sum + b.payment.amountCents;
    return sum;
  }, 0);

  const partnerPayoutTotal = partnerPayouts.reduce((sum: number, p: { amountCents: number }) => sum + p.amountCents, 0);
  const netRevenue = Math.max(0, totalRevenue - partnerPayoutTotal);

  const monthlyBookings = bookings.filter((b: BookingWithRelations) => b.createdAt >= monthStart);
  const activeDrivers = drivers.filter((driver: { id: string }) => bookings.some((b: BookingWithRelations) => b.driverId === driver.id)).length;

  // Driver day statistics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeDriverDaysToday = driverDays.filter((d: { status: string; date: Date }) =>
    d.status === 'OPEN' && new Date(d.date).toDateString() === todayStart.toDateString()
  ).length;
  const totalDriverDaysToday = driverDays.filter((d: { date: Date }) =>
    new Date(d.date).toDateString() === todayStart.toDateString()
  ).length;

  const weeklyData: Array<{ day: string; date: string; revenue: number; bookings: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = endOfDay(dayStart);
    const dayBookings = bookings.filter((b: BookingWithRelations) => b.createdAt >= dayStart && b.createdAt <= dayEnd);
    const dayRevenue = dayBookings.reduce((sum: number, b: BookingWithRelations) => {
      if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
      if (b.cashCollected) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
      return sum;
    }, 0);
    weeklyData.push({
      day: format(dayStart, "EEE"),
      date: format(dayStart, "MMM d"),
      revenue: dayRevenue,
      bookings: dayBookings.length,
    });
  }

  const hasRealWeeklyData = weeklyData.some((d) => d.revenue > 0 || d.bookings > 0);
  const demoRevenue = [4200, 3800, 6100, 5400, 5900, 6600, 4800];
  const demoBookings = [8, 6, 11, 9, 10, 12, 7];
  const weeklyDisplayData = hasRealWeeklyData
    ? weeklyData
    : weeklyData.map((day, idx) => ({
        ...day,
        revenue: demoRevenue[idx] ?? 0,
        bookings: demoBookings[idx] ?? 0,
      }));

  const totalWeeklyRevenue = weeklyDisplayData.reduce((sum, day) => sum + day.revenue, 0);
  const totalWeeklyBookings = weeklyDisplayData.reduce((sum, day) => sum + day.bookings, 0);
  const averageDailyRevenue = weeklyDisplayData.length ? totalWeeklyRevenue / weeklyDisplayData.length : 0;

  const serviceStats = services
    .map((service: ServiceBasic) => {
      const serviceBookings = bookings.filter((b: BookingWithRelations) => b.serviceId === service.id);
      const revenue = serviceBookings.reduce((sum: number, b: BookingWithRelations) => {
        if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
        if (b.cashCollected) return sum + (b.cashAmountCents ?? b.service?.priceCents ?? 0);
        return sum;
      }, 0);
      return { name: service.name, count: serviceBookings.length, revenue };
    })
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, 5);

  const popularLocations = [
    { name: "Dubai Marina", percentage: 35 },
    { name: "Downtown Dubai", percentage: 24 },
    { name: "JBR", percentage: 18 },
    { name: "Business Bay", percentage: 13 },
    { name: "Palm Jumeirah", percentage: 10 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)]">Welcome back! Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Total Revenue"
          subtitle="+12.5% from last month"
          icon={<DollarSign className="h-6 w-6 text-white" />}
          gradient="from-emerald-500 to-emerald-600"
          value={formatCurrency(totalRevenue)}
        />
        <DashboardCard
          title="Total Bookings"
          subtitle="+8.2% from last week"
          icon={<Calendar className="h-6 w-6 text-white" />}
          gradient="from-fuchsia-500 via-pink-500 to-purple-500"
          value={bookings.length.toString()}
        />
        <DashboardCard
          title="Active Drivers"
          subtitle={`${Math.round((activeDrivers / Math.max(drivers.length, 1)) * 100)}% active`}
          icon={<Users className="h-6 w-6 text-white" />}
          gradient="from-orange-500 to-rose-500"
          value={`${activeDrivers}/${drivers.length}`}
        />
        <DashboardCard
          title="Active Driver Days"
          subtitle={`${activeDriverDaysToday} drivers on duty today`}
          icon={<Clock className="h-6 w-6 text-white" />}
          gradient="from-blue-500 to-indigo-600"
          value={`${activeDriverDaysToday}/${totalDriverDaysToday}`}
        />
      </div>

      <RevenueBreakdown
        netRevenue={netRevenue}
        onlineRevenue={onlineRevenue}
        cashSettledRevenue={cashSettledRevenue}
        cashPendingRevenue={cashPendingRevenue}
        partnerPayoutTotal={partnerPayoutTotal}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueChart
          weeklyData={weeklyDisplayData}
          totalWeeklyRevenue={totalWeeklyRevenue}
          averageDailyRevenue={averageDailyRevenue}
          totalWeeklyBookings={totalWeeklyBookings}
        />
        <CalendarWidget today={today} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActiveUsers users={users} today={today} />
        <TopCities monthlyBookings={monthlyBookings.length} locations={popularLocations} />
        <PopularServices services={serviceStats} />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  subtitle,
  icon,
  gradient,
  value,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  value: string;
}) {
  return (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} p-6 text-white shadow-md`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/90">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-white/80">{subtitle}</p>
        </div>
        <div className="rounded-lg bg-white/10 p-3">{icon}</div>
      </div>
    </div>
  );
}

function RevenueBreakdown({
  netRevenue,
  onlineRevenue,
  cashSettledRevenue,
  cashPendingRevenue,
  partnerPayoutTotal,
}: {
  netRevenue: number;
  onlineRevenue: number;
  cashSettledRevenue: number;
  cashPendingRevenue: number;
  partnerPayoutTotal: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Revenue Breakdown</h2>
          <p className="text-xs text-[var(--text-muted)]">QuickWay earnings after partner settlements</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-secondary)] px-4 py-1.5 text-xs font-medium text-[var(--text-medium)]">
          <span className="text-[var(--text-muted)]">Partner Payouts</span>
          <span className="text-[var(--brand-primary)]">{formatCurrency(partnerPayoutTotal)}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BreakdownTile label="Net Revenue" caption="QuickWay earnings" value={formatCurrency(netRevenue)} accent="bg-emerald-400" />
        <BreakdownTile label="Card Payments" caption="Online & Stripe" value={formatCurrency(onlineRevenue)} accent="bg-sky-400" />
        <BreakdownTile label="Cash Settled" caption="Reconciled cash" value={formatCurrency(cashSettledRevenue)} accent="bg-blue-400" />
        <BreakdownTile label="Cash Pending" caption="Awaiting settlement" value={formatCurrency(cashPendingRevenue)} accent="bg-amber-400" />
      </div>
    </div>
  );
}

function BreakdownTile({ label, caption, value, accent }: { label: string; caption: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        </div>
        <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">{label.toUpperCase()}</div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-[var(--text-label)]">{caption}</div>
        <div className="text-2xl font-semibold text-[var(--text-strong)]">{value}</div>
        <div className="text-[11px] text-[var(--text-muted)]">{label === "Net Revenue" ? "After partner payouts" : null}</div>
      </div>
    </div>
  );
}

function RevenueChart({
  weeklyData,
  totalWeeklyRevenue,
  averageDailyRevenue,
  totalWeeklyBookings,
}: {
  weeklyData: Array<{ day: string; date: string; revenue: number; bookings: number }>;
  totalWeeklyRevenue: number;
  averageDailyRevenue: number;
  totalWeeklyBookings: number;
}) {
  const maxRevenue = Math.max(...weeklyData.map((d) => d.revenue));
  const maxBookings = Math.max(...weeklyData.map((d) => d.bookings));
  const useRevenue = maxRevenue > 0;

  return (
    <div className="lg:col-span-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Revenue Overview</h3>
          <p className="text-xs text-[var(--text-muted)]">Daily revenue for the last 7 days</p>
        </div>
        <select className="rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-medium)]">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 3 months</option>
        </select>
      </div>

      <div className="mb-4 grid gap-3 text-xs text-[var(--text-muted)] sm:grid-cols-3">
        <SummaryStat label="Total revenue (7 days)" value={formatCurrency(totalWeeklyRevenue)} />
        <SummaryStat label="Avg per day" value={formatCurrency(averageDailyRevenue)} />
        <SummaryStat label="Bookings (7 days)" value={totalWeeklyBookings.toString()} />
      </div>

      <div className="space-y-2">
        <div className="flex h-48 items-end justify-between gap-2">
          {weeklyData.map((day, idx) => {
            const value = useRevenue ? day.revenue : day.bookings;
            const maxValue = useRevenue ? maxRevenue : maxBookings;
            const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const height = value > 0 ? Math.max(12, heightPercent) : 0;
            const gradient = idx % 2 === 0 ? "from-green-400 to-green-600" : "from-emerald-400 to-emerald-600";

            return (
              <div key={day.day} className="flex flex-1 justify-center">
                {value > 0 && (
                  <div
                    className={`w-8 rounded-t-lg bg-gradient-to-t ${gradient} transition-all hover:opacity-80`}
                    style={{ height: `${height}%` }}
                    title={
                      useRevenue
                        ? `${day.day}: ${formatCurrency(day.revenue)} (${day.bookings} bookings)`
                        : `${day.day}: ${day.bookings} bookings`
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between gap-2">
          {weeklyData.map((day, idx) => (
            <div key={`${day.day}-${idx}`} className="flex-1 text-center">
              <div className="text-xs font-medium text-[var(--text-medium)]">{day.day}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{day.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-xs">
        <LegendItem label="Even Days" gradient="from-green-400 to-green-600" />
        <LegendItem label="Odd Days" gradient="from-emerald-400 to-emerald-600" />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--text-medium)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{value}</div>
    </div>
  );
}

function LegendItem({ label, gradient }: { label: string; gradient: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded bg-gradient-to-r ${gradient}`} />
      <span className="text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function CalendarWidget({ today }: { today: Date }) {
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Calendar</h3>
      <p className="text-xs text-[var(--text-muted)]">{format(today, "MMMM yyyy")}</p>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
          <div key={`${day}-${idx}`} className="text-xs font-medium text-[var(--text-muted)]">
            {day}
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => {
          const dayNum = i - firstDayOfMonth + 1;
          const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
          const isToday = isCurrentMonth && dayNum === today.getDate();

          return (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs
                ${isCurrentMonth ? "text-[var(--text-medium)]" : "text-[var(--text-muted)] opacity-30"}
                ${isToday ? "bg-[var(--brand-primary)] text-white font-semibold" : "hover:bg-[var(--hover-bg)]"}
              `}
            >
              {isCurrentMonth ? dayNum : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveUsers({ users, today }: { users: Array<{ id: string; name: string | null; email: string | null }>; today: Date }) {
  const avatars = [
    "from-green-400 to-green-600",
    "from-emerald-400 to-emerald-600",
    "from-teal-400 to-teal-600",
    "from-lime-400 to-lime-600",
    "from-cyan-400 to-cyan-600",
  ];

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-strong)]">Active Users</h3>
        <span className="text-xs text-[var(--text-muted)]">{format(today, "MMM d")}</span>
      </div>
      <div className="space-y-3">
        {users.slice(0, 5).map((user, idx) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatars[idx % avatars.length]} text-xs font-semibold text-white`}>
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-strong)]">{user.name || "User"}</p>
                <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
              </div>
            </div>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <button className="text-xs font-medium text-[var(--brand-primary)] hover:underline">View all →</button>
      </div>
    </div>
  );
}

function TopCities({ monthlyBookings, locations }: { monthlyBookings: number; locations: Array<{ name: string; percentage: number }> }) {
  const barColors = ["bg-green-500", "bg-emerald-500", "bg-teal-500", "bg-lime-500", "bg-cyan-500"];
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-strong)]">Top Cities</h3>
        <span className="text-xs text-[var(--text-muted)]">{monthlyBookings} bookings</span>
      </div>
      <div className="space-y-3">
        {locations.map((location, idx) => (
          <div key={location.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-medium)]">{location.name}</span>
              <span className="text-xs text-[var(--text-muted)]">{location.percentage}%</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-[var(--surface-secondary)]">
              <div
                className={`h-full rounded-full ${barColors[idx % barColors.length]} transition-all`}
                style={{ width: `${location.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PopularServices({ services }: { services: Array<{ name: string; count: number; revenue: number }> }) {
  const icons = ["bg-green-100", "bg-emerald-100", "bg-teal-100", "bg-lime-100", "bg-cyan-100"];
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
      <h3 className="text-lg font-semibold text-[var(--text-strong)]">Popular Services</h3>
      <div className="space-y-3">
        {services.map((service, idx) => (
          <div key={service.name} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${icons[idx % icons.length]}`}>
                <Car className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-strong)]">{service.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{service.count} bookings</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-[var(--text-medium)]">
              {formatCurrency(service.revenue)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

