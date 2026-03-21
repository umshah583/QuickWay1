"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  TrendingUp, 
  Users, 
  Clock,
  Package,
  BarChart3,
  Filter,
  Star,
  Repeat
} from "lucide-react";

type GrowthData = {
  date: string;
  bookings: number;
  revenue: number;
};

type PeakHour = {
  hour: number;
  count: number;
};

type RepeatCustomer = {
  id: string;
  name: string | null;
  count: number;
};

type Booking = {
  id: string;
  createdAt: Date;
  locationLabel: string | null;
  service: { id: string; name: string; priceCents: number } | null;
  user: { id: string; name: string | null; email: string | null } | null;
  payment: { status: string; amountCents: number } | null;
};

interface AnalyticsDashboardClientProps {
  growthData: GrowthData[];
  peakHours: PeakHour[];
  repeatCustomers: RepeatCustomer[];
  repeatRate: number;
  conversionRate: number;
  totalCustomers: number;
  subscribedUsers: number;
  cities: string[];
  bookings: Booking[];
}

export function AnalyticsDashboardClient({
  growthData,
  peakHours,
  repeatCustomers,
  repeatRate,
  conversionRate,
  totalCustomers,
  subscribedUsers,
  cities,
  bookings,
}: AnalyticsDashboardClientProps) {
  const [dateFilter, setDateFilter] = useState<string>("30days");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let filtered = bookings;

    // City filter
    if (cityFilter !== "all") {
      filtered = filtered.filter(b => b.locationLabel?.includes(cityFilter));
    }

    // Date filter
    const today = new Date();
    if (dateFilter !== "all") {
      const daysAgo = dateFilter === "7days" ? 7 : dateFilter === "30days" ? 30 : 90;
      const cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - daysAgo);
      filtered = filtered.filter(b => new Date(b.createdAt) >= cutoffDate);
    }

    return filtered;
  }, [bookings, cityFilter, dateFilter]);

  // Recalculate metrics based on filtered data
  const filteredMetrics = useMemo(() => {
    const serviceStats = filteredData.reduce((acc, booking) => {
      if (booking.service) {
        const serviceName = booking.service.name;
        if (!acc[serviceName]) {
          acc[serviceName] = { name: serviceName, count: 0, revenue: 0 };
        }
        acc[serviceName].count++;
        if (booking.payment?.status === "PAID") {
          acc[serviceName].revenue += booking.payment.amountCents;
        }
      }
      return acc;
    }, {} as Record<string, { name: string; count: number; revenue: number }>);

    const services = Object.values(serviceStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const hourlyStats = filteredData.reduce((acc, booking) => {
      const hour = new Date(booking.createdAt).getHours();
      if (!acc[hour]) {
        acc[hour] = 0;
      }
      acc[hour]++;
      return acc;
    }, {} as Record<number, number>);

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyStats[hour] || 0,
    }));

    return { services, hours };
  }, [filteredData]);

  const maxGrowthBookings = Math.max(...growthData.map(d => d.bookings), 1);
  const maxGrowthRevenue = Math.max(...growthData.map(d => d.revenue), 1);
  const maxPeakHour = Math.max(...peakHours.map(h => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Business insights and performance metrics
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-[var(--brand-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--text-strong)]">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
              City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/10">
              <Users className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Total Customers</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/10">
              <Repeat className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Repeat Rate</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{repeatRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/10">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Subscribed Users</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{subscribedUsers}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/10">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Conversion Rate</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{conversionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-[var(--brand-primary)]" />
          <h3 className="text-lg font-bold text-[var(--text-strong)]">Growth Trends (30 Days)</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bookings Growth */}
          <div>
            <p className="text-sm font-semibold text-[var(--text-muted)] mb-4">Daily Bookings</p>
            <div className="h-48 relative">
              <div className="absolute inset-0 flex items-end justify-between gap-1">
                {growthData.map((data, index) => {
                  const height = (data.bookings / maxGrowthBookings) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col justify-end h-full">
                        <div
                          className="w-full bg-gradient-to-t from-[var(--brand-primary)] to-[var(--brand-aqua)] rounded-t-lg transition-all hover:opacity-80 relative group"
                          style={{ height: `${height}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[var(--brand-navy)] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                            {format(new Date(data.date), "MMM dd")}<br />
                            {data.bookings} bookings
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Revenue Growth */}
          <div>
            <p className="text-sm font-semibold text-[var(--text-muted)] mb-4">Daily Revenue</p>
            <div className="h-48 relative">
              <div className="absolute inset-0 flex items-end justify-between gap-1">
                {growthData.map((data, index) => {
                  const height = (data.revenue / maxGrowthRevenue) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col justify-end h-full">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 to-green-400 rounded-t-lg transition-all hover:opacity-80 relative group"
                          style={{ height: `${height}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[var(--brand-navy)] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                            {format(new Date(data.date), "MMM dd")}<br />
                            {formatCurrency(data.revenue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Services & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Services */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Star className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-strong)]">Popular Services</h3>
          </div>
          <div className="space-y-4">
            {filteredMetrics.services.map((service, index) => {
              const maxCount = filteredMetrics.services[0]?.count || 1;
              const percentage = (service.count / maxCount) * 100;
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[var(--text-strong)]">{service.name}</span>
                    <span className="text-sm font-bold text-[var(--brand-primary)]">{service.count}</span>
                  </div>
                  <div className="relative h-6 bg-[var(--surface-secondary)] rounded-xl overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] rounded-xl transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Revenue: {formatCurrency(service.revenue)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-strong)]">Peak Hours</h3>
          </div>
          <div className="h-64 relative">
            <div className="absolute inset-0 flex items-end justify-between gap-0.5">
              {filteredMetrics.hours.map((hourData, index) => {
                const height = (hourData.count / maxPeakHour) * 100;
                const isPeak = hourData.count > maxPeakHour * 0.7;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col justify-end h-full">
                      <div
                        className={`w-full rounded-t transition-all hover:opacity-80 relative group ${
                          isPeak
                            ? "bg-gradient-to-t from-amber-500 to-orange-400"
                            : "bg-gradient-to-t from-blue-500 to-cyan-400"
                        }`}
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[var(--brand-navy)] text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                          {hourData.hour}:00<br />
                          {hourData.count} bookings
                        </div>
                      </div>
                    </div>
                    {index % 3 === 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] mt-1">{hourData.hour}h</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Repeat Customers & Subscription Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repeat Customers */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Repeat className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-strong)]">Top Repeat Customers</h3>
          </div>
          <div className="space-y-3">
            {repeatCustomers.map((customer, index) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--hover-bg)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-strong)]">
                      {customer.name || "Guest User"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Customer ID: {customer.id.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--brand-primary)]">{customer.count}</p>
                  <p className="text-xs text-[var(--text-muted)]">bookings</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Conversion */}
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-strong)]">Subscription Conversion</h3>
          </div>
          <div className="space-y-6">
            {/* Conversion Rate Circle */}
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="var(--surface-secondary)"
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="url(#gradient)"
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${(conversionRate / 100) * 502.4} 502.4`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--brand-primary)" />
                      <stop offset="100%" stopColor="var(--brand-aqua)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <p className="text-4xl font-bold text-[var(--text-strong)]">{conversionRate.toFixed(1)}%</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Conversion</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[var(--surface-secondary)]">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Total Users</p>
                <p className="text-2xl font-bold text-[var(--text-strong)]">{totalCustomers}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Subscribed</p>
                <p className="text-2xl font-bold text-[var(--brand-primary)]">{subscribedUsers}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
