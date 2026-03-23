import { prisma } from "@/lib/prisma";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { Car, Calendar, DollarSign, CheckCircle, AlertCircle, Package } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { RecentBookingsTable } from "./components/RecentBookingsTable";

export const dynamic = "force-dynamic";

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: { 
    Service: true; 
    User_Booking_userIdToUser: true; 
    User_Booking_driverIdToUser: true; 
    Payment: true 
  };
}>;

type ServiceBasic = { id: string; name: string; priceCents: number };

function formatCurrency(cents: number) {
  // Use consistent formatting to avoid hydration mismatches
  const amount = cents / 100;
  return `AED ${amount.toFixed(2)}`;
}

export default async function ModernDashboard() {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const monthStart = startOfDay(subDays(today, 30));

  const [bookings, services, users, partnerPayouts, activeSubscriptions] = await Promise.all([
    prisma.booking.findMany({
      include: { 
        Service: true, 
        User_Booking_userIdToUser: true, 
        User_Booking_driverIdToUser: true, 
        Payment: true 
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.service.findMany({ select: { id: true, name: true, priceCents: true } }),
    prisma.user.findMany({
      where: { role: "USER" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.partnerPayout.findMany({ select: { amountCents: true } }),
    prisma.subscriptionRequest.count(),
  ]);

  // Today's metrics
  const todayBookings = bookings.filter((b: BookingWithRelations) => b.createdAt >= todayStart && b.createdAt <= todayEnd);
  const todayRevenue = todayBookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.Payment && b.Payment.status === "PAID") return sum + b.Payment.amountCents;
    if (b.cashCollected) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
    return sum;
  }, 0);

  const totalRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.Payment && b.Payment.status === "PAID") return sum + b.Payment.amountCents;
    if (b.cashCollected) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
    return sum;
  }, 0);

  const completedWashes = bookings.filter((b: BookingWithRelations) => b.taskStatus === "COMPLETED").length;
  const pendingRequests = bookings.filter((b: BookingWithRelations) => b.status === "PENDING").length;
  const activeSubscriptionsCount = activeSubscriptions;

  const cashSettledRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.cashCollected && b.cashSettled) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
    return sum;
  }, 0);

  const cashPendingRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.cashCollected && !b.cashSettled) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
    return sum;
  }, 0);

  const onlineRevenue = bookings.reduce((sum: number, b: BookingWithRelations) => {
    if (b.Payment && b.Payment.status === "PAID" && b.Payment.provider === "STRIPE") return sum + b.Payment.amountCents;
    return sum;
  }, 0);

  const partnerPayoutTotal = partnerPayouts.reduce((sum: number, p: { amountCents: number }) => sum + p.amountCents, 0);
  const netRevenue = Math.max(0, totalRevenue - partnerPayoutTotal);

  const monthlyBookings = bookings.filter((b: BookingWithRelations) => b.createdAt >= monthStart);

  const weeklyData: Array<{ day: string; date: string; revenue: number; bookings: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = endOfDay(dayStart);
    const dayBookings = bookings.filter((b: BookingWithRelations) => b.createdAt >= dayStart && b.createdAt <= dayEnd);
    const dayRevenue = dayBookings.reduce((sum: number, b: BookingWithRelations) => {
      if (b.Payment && b.Payment.status === "PAID") return sum + b.Payment.amountCents;
      if (b.cashCollected) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
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
  const weeklyDisplayData = hasRealWeeklyData ? weeklyData : weeklyData;

  const totalWeeklyRevenue = weeklyDisplayData.reduce((sum, day) => sum + day.revenue, 0);
  const totalWeeklyBookings = weeklyDisplayData.reduce((sum, day) => sum + day.bookings, 0);
  const averageDailyRevenue = weeklyDisplayData.length ? totalWeeklyRevenue / weeklyDisplayData.length : 0;

  const serviceStats = services
    .map((service: ServiceBasic) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serviceBookings = bookings.filter((b: any) => b.serviceId === service.id);
      const revenue = serviceBookings.reduce((sum: number, b: BookingWithRelations) => {
        if (b.Payment && b.Payment.status === "PAID") return sum + b.Payment.amountCents;
        if (b.cashCollected) return sum + (b.cashAmountCents ?? b.Service?.priceCents ?? 0);
        return sum;
      }, 0);
      return { name: service.name, count: serviceBookings.length, revenue };
    })
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, 5);

  // Calculate popular locations from actual booking data
  const locationStats = bookings.reduce((acc: Record<string, number>, booking) => {
    const location = booking.locationLabel || 'Unknown';
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {});

  const totalBookings = Object.values(locationStats).reduce((sum, count) => sum + count, 0);
  const popularLocations = Object.entries(locationStats)
    .map(([name, count]) => ({
      name,
      percentage: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <DashboardCard
          title="Total Bookings"
          subtitle={`${todayBookings.length} today`}
          icon={<Calendar className="h-6 w-6 text-white" />}
          gradient="from-cyan-500 via-sky-500 to-blue-500"
          value={bookings.length.toString()}
        />
        <DashboardCard
          title="Today's Revenue"
          subtitle={`${todayBookings.length} bookings`}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          gradient="from-blue-500 via-indigo-500 to-purple-500"
          value={formatCurrency(todayRevenue)}
        />
        <DashboardCard
          title="Active Subscriptions"
          subtitle="Monthly plans"
          icon={<Package className="h-6 w-6 text-white" />}
          gradient="from-teal-500 via-cyan-500 to-sky-500"
          value={activeSubscriptionsCount.toString()}
        />
        <DashboardCard
          title="Completed Washes"
          subtitle={`${Math.round((completedWashes / Math.max(bookings.length, 1)) * 100)}% completion rate`}
          icon={<CheckCircle className="h-6 w-6 text-white" />}
          gradient="from-emerald-500 via-green-500 to-teal-500"
          value={completedWashes.toString()}
        />
        <DashboardCard
          title="Pending Requests"
          subtitle="Awaiting assignment"
          icon={<AlertCircle className="h-6 w-6 text-white" />}
          gradient="from-amber-500 via-orange-500 to-red-500"
          value={pendingRequests.toString()}
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

      {/* Recent Bookings Table */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RecentBookingsTable bookings={bookings.slice(0, 10).map((b: any) => ({
        id: b.id,
        createdAt: b.createdAt,
        status: b.status,
        taskStatus: b.taskStatus,
        service: b.Service ? { name: b.Service.name, priceCents: b.Service.priceCents } : null,
        user: b.User_Booking_userIdToUser ? { name: b.User_Booking_userIdToUser.name, email: b.User_Booking_userIdToUser.email } : null,
        payment: b.Payment ? { status: b.Payment.status, amountCents: b.Payment.amountCents } : null,
        cashCollected: b.cashCollected,
        cashAmountCents: b.cashAmountCents,
        location: b.locationLabel,
      }))} />
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
    <div className={`glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]`}>
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
      
      <div className="relative flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/90 uppercase tracking-wide">{title}</p>
          <p className="mt-3 text-3xl font-bold text-white drop-shadow-lg">{value}</p>
          <p className="mt-2 text-xs text-white/80 font-medium">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-4 shadow-lg">
          {icon}
        </div>
      </div>
      
      {/* Decorative water ripple effect */}
      <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
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
    <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm px-6 py-6 shadow-lg hover:shadow-xl transition-all">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">Revenue Breakdown</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">QuickWay earnings after partner settlements</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5 border border-[var(--brand-primary)]/20 px-4 py-1.5 text-xs font-semibold text-[var(--text-medium)]">
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

