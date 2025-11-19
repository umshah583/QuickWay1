import { prisma } from "@/lib/prisma";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { 
  TrendingUp, 
  Users, 
  Car, 
  DollarSign,
  Calendar,
  MapPin,
  Activity,
  Clock
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

// Color palette for charts and cards
const colors = {
  primary: "#4f46e5",
  secondary: "#06b6d4",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
};

export default async function ModernDashboard() {
  const today = new Date();
  const weekStart = startOfDay(subDays(today, 6));
  const monthStart = startOfDay(subDays(today, 30));

  const [bookings, drivers, services, users, recentTransactions, partnerPayouts] = await Promise.all([
    prisma.booking.findMany({
      include: { service: true, user: true, driver: true, payment: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: "DRIVER" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.service.findMany({
      select: { id: true, name: true, priceCents: true },
    }),
    prisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.payment.findMany({
      include: { booking: { include: { user: true, service: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.partnerPayout.findMany({
      select: { amountCents: true },
    }),
  ]);

  // Calculate metrics
  const totalRevenue = bookings.reduce((sum, b) => {
    if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
    if (b.cashCollected && b.service) return sum + b.service.priceCents;
    return sum;
  }, 0);

  const monthlyBookings = bookings.filter((b) => b.createdAt >= monthStart);
  const monthlyRevenue = monthlyBookings.reduce((sum, b) => {
    if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
    if (b.cashCollected && b.service) return sum + b.service.priceCents;
    return sum;
  }, 0);

  const activeDrivers = drivers.filter(d => {
    const driverBookings = bookings.filter(b => b.driverId === d.id);
    return driverBookings.length > 0;
  }).length;

  const completedBookings = bookings.filter(b => b.taskStatus === "COMPLETED").length;
  const pendingBookings = bookings.filter(b => b.status === "PENDING").length;

  const cashRevenue = bookings.reduce((sum, b) => {
    if (b.cashCollected) {
      const base = b.cashAmountCents ?? b.service?.priceCents ?? 0;
      return sum + base;
    }
    return sum;
  }, 0);

  const cashSettledRevenue = bookings.reduce((sum, b) => {
    if (b.cashCollected && b.cashSettled) {
      const base = b.cashAmountCents ?? b.service?.priceCents ?? 0;
      return sum + base;
    }
    return sum;
  }, 0);

  const cashPendingRevenue = bookings.reduce((sum, b) => {
    if (b.cashCollected && !b.cashSettled) {
      const base = b.cashAmountCents ?? b.service?.priceCents ?? 0;
      return sum + base;
    }
    return sum;
  }, 0);

  const onlineRevenue = bookings.reduce((sum, b) => {
    if (b.payment && b.payment.status === "PAID") {
      return sum + b.payment.amountCents;
    }
    return sum;
  }, 0);

  const partnerPayoutTotal = partnerPayouts.reduce((sum, p) => sum + p.amountCents, 0);
  const netRevenue = Math.max(0, totalRevenue - partnerPayoutTotal);

  // Weekly data for chart
  const weeklyData: Array<{ day: string; date: string; revenue: number; bookings: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = endOfDay(dayStart);
    const dayBookings = bookings.filter((b) => b.createdAt >= dayStart && b.createdAt <= dayEnd);
    const dayRevenue = dayBookings.reduce((sum, b) => {
      if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
      if (b.cashCollected && b.service) return sum + b.service.priceCents;
      return sum;
    }, 0);
    weeklyData.push({
      day: format(dayStart, "EEE"),
      date: format(dayStart, "MMM d"),
      revenue: dayRevenue,
      bookings: dayBookings.length,
    });
  }

  const hasRealWeeklyData = weeklyData.some((day) => day.revenue > 0 || day.bookings > 0);
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
  const averageDailyRevenue = weeklyDisplayData.length > 0 ? totalWeeklyRevenue / weeklyDisplayData.length : 0;

  // Top services
  const serviceStats = services.map(service => {
    const serviceBookings = bookings.filter(b => b.serviceId === service.id);
    return {
      name: service.name,
      count: serviceBookings.length,
      revenue: serviceBookings.reduce((sum, b) => {
        if (b.payment && b.payment.status === "PAID") return sum + b.payment.amountCents;
        if (b.cashCollected) return sum + service.priceCents;
        return sum;
      }, 0),
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Get popular locations (mock data for now - you can replace with actual location data)
  const popularLocations = [
    { name: "Dubai Marina", bookings: 145, percentage: 35 },
    { name: "Downtown Dubai", bookings: 98, percentage: 24 },
    { name: "JBR", bookings: 76, percentage: 18 },
    { name: "Business Bay", bookings: 54, percentage: 13 },
    { name: "Palm Jumeirah", bookings: 41, percentage: 10 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-strong)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)]">Welcome back! Here's what's happening with your business today.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalRevenue)}</p>
              <p className="mt-1 text-xs text-[var(--success)]">+12.5% from last month</p>
            </div>
            <div className="rounded-lg bg-[var(--primary-gradient)] p-3">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Bookings</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{bookings.length}</p>
              <p className="mt-1 text-xs text-[var(--success)]">+8.2% from last week</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Drivers</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeDrivers}/{drivers.length}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{Math.round((activeDrivers/drivers.length) * 100)}% active</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Avg Service Time</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">45 min</p>
              <p className="mt-1 text-xs text-[var(--warning)]">+5 min from average</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown - reference style */}
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">
                NET REVENUE
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">QuickWay earnings</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(netRevenue)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">After partner payouts</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">
                CARD PAYMENTS
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Online & Stripe</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(onlineRevenue)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Captured via gateway</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">
                CASH SETTLED
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Reconciled cash</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(cashSettledRevenue)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Marked as settled</div>
            </div>
          </div>

          <div className="rounded-xl bg-[var(--background)]/40 px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">
                CASH PENDING
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[var(--text-label)]">Awaiting settlement</div>
              <div className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(cashPendingRevenue)}</div>
              <div className="text-[11px] text-[var(--text-muted)]">Collected by drivers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
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
            <div>
              <div className="text-[var(--text-medium)]">Total revenue (7 days)</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                {formatCurrency(totalWeeklyRevenue)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-medium)]">Avg per day</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                {formatCurrency(averageDailyRevenue)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-medium)]">Bookings (7 days)</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                {totalWeeklyBookings}
              </div>
            </div>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="space-y-2">
            <div className="flex h-48 items-end justify-between gap-2">
              {weeklyData.map((day, idx) => {
                // Use revenue if available, otherwise use booking count for visualization
                const maxRevenue = Math.max(...weeklyData.map(d => d.revenue));
                const maxBookings = Math.max(...weeklyData.map(d => d.bookings));
                const useRevenue = maxRevenue > 0;
                const value = useRevenue ? day.revenue : day.bookings;
                const maxValue = useRevenue ? maxRevenue : maxBookings;
                
                const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const height = value > 0 ? Math.max(12, heightPercent) : 0;
                const gradient = idx % 2 === 0 ? "from-green-400 to-green-600" : "from-emerald-400 to-emerald-600";
                
                return (
                  <div key={day.day} className="flex flex-1 justify-center">
                    {value > 0 && (
                      <div 
                        className={`w-8 rounded-t-lg bg-gradient-to-t ${gradient} transition-all hover:opacity-80 cursor-pointer`}
                        style={{ height: `${height}%` }}
                        title={useRevenue 
                          ? `${day.day}: ${formatCurrency(day.revenue)} (${day.bookings} bookings)`
                          : `${day.day}: ${day.bookings} bookings (no revenue yet)`
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              {weeklyData.map((day) => (
                <div key={`label-${day.day}`} className="flex-1 text-center">
                  <div className="text-xs font-medium text-[var(--text-medium)]">{day.day}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{day.date}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-gradient-to-r from-green-400 to-green-600" />
              <span className="text-[var(--text-muted)]">Even Days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <span className="text-[var(--text-muted)]">Odd Days</span>
            </div>
          </div>
        </div>

        {/* Calendar Widget */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">Calendar</h3>
          <p className="text-xs text-[var(--text-muted)]">{format(today, "MMMM yyyy")}</p>
          
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
              <div key={day} className="text-xs font-medium text-[var(--text-muted)]">
                {day}
              </div>
            ))}
            {/* Generate calendar days */}
            {Array.from({ length: 35 }, (_, i) => {
              const dayNum = i - new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 1;
              const isCurrentMonth = dayNum > 0 && dayNum <= new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
              const isToday = dayNum === today.getDate();
              
              return (
                <div
                  key={i}
                  className={`
                    aspect-square flex items-center justify-center rounded-lg text-xs
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
      </div>

      {/* Bottom Section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active Users */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Active Users</h3>
            <span className="text-xs text-[var(--text-muted)]">{format(today, "MMM d")}</span>
          </div>
          
          <div className="space-y-3">
            {users.slice(0, 5).map((user, idx) => {
              const avatarColors = [
                "from-green-400 to-green-600",
                "from-emerald-400 to-emerald-600",
                "from-teal-400 to-teal-600",
                "from-lime-400 to-lime-600",
                "from-cyan-400 to-cyan-600",
              ];
              
              return (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[idx]} text-xs font-semibold text-white`}>
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-strong)]">{user.name || "User"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex h-2 w-2 rounded-full bg-green-500" />
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-center">
            <button className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
              View all →
            </button>
          </div>
        </div>

        {/* Top Cities */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Top Cities</h3>
            <span className="text-xs text-[var(--text-muted)]">{monthlyBookings.length} bookings</span>
          </div>
          
          <div className="space-y-3">
            {popularLocations.map((location, idx) => {
              const barColors = [
                "bg-green-500",
                "bg-emerald-500",
                "bg-teal-500",
                "bg-lime-500",
                "bg-cyan-500",
              ];
              
              return (
                <div key={location.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-medium)]">{location.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{location.percentage}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-[var(--surface-secondary)]">
                    <div
                      className={`h-full rounded-full ${barColors[idx]} transition-all`}
                      style={{ width: `${location.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Topics */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Popular Services</h3>
            <p className="text-xs text-[var(--text-muted)]">Most booked this month</p>
          </div>
          
          <div className="space-y-3">
            {serviceStats.slice(0, 5).map((service, idx) => {
              const iconColors = [
                "bg-green-100 text-green-600",
                "bg-emerald-100 text-emerald-600",
                "bg-teal-100 text-teal-600",
                "bg-lime-100 text-lime-600",
                "bg-cyan-100 text-cyan-600",
              ];
              
              return (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${iconColors[idx]}`}>
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
